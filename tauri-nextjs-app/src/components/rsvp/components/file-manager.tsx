'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Plus, Play, Trash2 } from 'lucide-react';
import { TauriFileAPI, FileMetadata } from '@/lib/tauri-file-api';

interface FileManagerProps {
  onProjectSelected: (project: FileMetadata, wordIndex: number) => void;
  currentProjectId?: string;
}

export function FileManager({ onProjectSelected, currentProjectId }: FileManagerProps) {
  const [projects, setProjects] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const loadedProjects = await TauriFileAPI.loadProjects();
      setProjects(loadedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Listen for progress updates and reload projects
  useEffect(() => {
    const handleProgressUpdate = () => {
      loadProjects(); // Reload projects to show updated progress
    };

    // Listen for custom progress update events
    window.addEventListener('project-progress-updated', handleProgressUpdate);

    return () => {
      window.removeEventListener('project-progress-updated', handleProgressUpdate);
    };
  }, [loadProjects]);

  const handleImportFile = async () => {
    setLoading(true);
    try {
      const newProject = await TauriFileAPI.pickAndImportFile();
      if (newProject) {
        setProjects(prev => [newProject, ...prev]);
        // Automatically select the new project
        onProjectSelected(newProject, 0);
      }
    } catch (error) {
      console.error('Failed to import file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = async (project: FileMetadata) => {
    try {
      // Load the saved progress for this project
      const savedProgress = await TauriFileAPI.loadSessionProgress(project.id);
      const wordIndex = savedProgress ?? project.current_word_index;

      onProjectSelected(project, wordIndex);
    } catch (error) {
      console.error('Failed to select project:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const formatProgress = (current: number, total: number) => {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    return `${current.toLocaleString()} / ${total.toLocaleString()} (${percentage}%)`;
  };

  return (
    <div className="w-80 h-full bg-gray-900 border-r border-gray-700 flex flex-col text-white">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold mb-3 font-mono">Library</h2>
        <Button
          onClick={handleImportFile}
          disabled={loading}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Import Text File
        </Button>
                <p className="text-xs text-gray-400 mt-2 font-mono">
          Supports large files with efficient streaming
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {projects.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="font-mono">No projects yet</p>
            <p className="text-sm font-mono">Import a text file to get started</p>
          </div>
        ) : (
          projects.map((project) => (
            <Card
              key={project.id}
              className={`cursor-pointer transition-colors bg-gray-800 border-gray-700 hover:bg-gray-700 ${
                currentProjectId === project.id ? 'ring-2 ring-blue-400' : ''
              }`}
              onClick={() => handleSelectProject(project)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between text-white font-mono">
                  <span className="truncate">{project.filename}</span>
                  <Play className="w-4 h-4 text-blue-400 flex-shrink-0" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1 text-xs text-gray-300 font-mono">
                  <div>
                    Progress: {formatProgress(project.current_word_index, project.total_words)}
                  </div>
                  <div>
                    Words: {project.total_words.toLocaleString()}
                  </div>
                  <div>
                    Created: {formatDate(project.created_at)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}