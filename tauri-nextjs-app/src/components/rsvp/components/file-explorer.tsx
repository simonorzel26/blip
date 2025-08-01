"use client";

import { useState, useCallback, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { FolderOpen, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { hashString, FileSystemService } from "../services";

interface FileProject {
  id: string;
  name: string;
  filePath: string;
  wordCount: number;
  lastRead: number;
  createdAt: string;
  chunkSize: number;
  totalChunks: number;
  estimatedPages: number;
}

// Single Responsibility: Project management
class ProjectManager {
  static loadProjects(): FileProject[] {
    try {
      const saved = localStorage.getItem('file-projects');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load projects:', error);
      return [];
    }
  }

  static saveProjects(projects: FileProject[]): void {
    try {
      localStorage.setItem('file-projects', JSON.stringify(projects));
    } catch (error) {
      console.error('Failed to save projects:', error);
    }
  }

  static deleteProject(projectId: string, projects: FileProject[]): FileProject[] {
    return projects.filter(p => p.id !== projectId);
  }
}

// Single Responsibility: File operations
class FileOperations {
  static async openFile(): Promise<{ selected: string | null; error?: string }> {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Text Files',
          extensions: ['txt', 'md', 'text']
        }]
      });

      return { selected: selected && typeof selected === 'string' ? selected : null };
    } catch (error) {
      console.error('Failed to open file:', error);
      return { selected: null, error: 'Failed to open file' };
    }
  }

  static async readFileContent(filePath: string): Promise<{ content: string; error?: string }> {
    try {
      const content = await readTextFile(filePath);
      return { content };
    } catch (error) {
      console.error('Failed to read file:', error);
      return { content: '', error: 'Failed to read file' };
    }
  }
}

// Single Responsibility: Project creation
class ProjectCreator {
  static createProject(filePath: string, fileName: string, content: string): FileProject {
    const projectId = hashString(content + Date.now()).toString();
    const { totalWords, estimatedPages } = FileSystemService.getFileMetadata(content);

    return {
      id: projectId,
      name: fileName,
      filePath,
      wordCount: totalWords,
      lastRead: 0,
      createdAt: new Date().toISOString(),
      chunkSize: totalWords,
      totalChunks: 1,
      estimatedPages
    };
  }
}

// Single Responsibility: UI utilities
class UIUtils {
  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  static formatWordCount(wordCount: number): string {
    if (wordCount >= 1000000) {
      return `${(wordCount / 1000000).toFixed(1)}M words`;
    } else if (wordCount >= 1000) {
      return `${(wordCount / 1000).toFixed(1)}K words`;
    } else {
      return `${wordCount} words`;
    }
  }

  static getProgressPercentage(project: FileProject): number {
    return Math.round((project.lastRead / project.wordCount) * 100);
  }

  static getProgressText(project: FileProject): string {
    const percentage = this.getProgressPercentage(project);
    const wordsRead = project.lastRead || 0;
    const totalWords = project.wordCount;

    return `${wordsRead.toLocaleString()} / ${totalWords.toLocaleString()} words (${percentage}%)`;
  }
}

export const FileExplorer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<FileProject[]>([]);

  const loadProjects = useCallback(() => {
    const loadedProjects = ProjectManager.loadProjects();
    setProjects(loadedProjects);
  }, []);

  const saveProjects = useCallback((projectsList: FileProject[]) => {
    ProjectManager.saveProjects(projectsList);
    setProjects(projectsList);
  }, []);

  // Listen for progress updates
  useEffect(() => {
    const handleProjectProgressUpdated = (event: CustomEvent) => {
      const { projectId, currentWordIndex, updatedProject } = event.detail;

      setProjects(prevProjects =>
        prevProjects.map(project =>
          project.id === projectId
            ? { ...project, lastRead: currentWordIndex, lastReadDate: updatedProject.lastReadDate }
            : project
        )
      );
    };

    window.addEventListener('project-progress-updated', handleProjectProgressUpdated as EventListener);

    return () => {
      window.removeEventListener('project-progress-updated', handleProjectProgressUpdated as EventListener);
    };
  }, []);

  const handleOpenFile = useCallback(async () => {
    const { selected, error } = await FileOperations.openFile();

    if (error || !selected) {
      console.error('Failed to open file:', error);
      return;
    }

    const { content, error: readError } = await FileOperations.readFileContent(selected);

    if (readError || !content) {
      console.error('Failed to read file:', readError);
      return;
    }

    const fileName = selected.split('/').pop()?.split('.')[0] || 'Untitled';
    const newProject = ProjectCreator.createProject(selected, fileName, content);

    const updatedProjects = [newProject, ...projects];
    saveProjects(updatedProjects);

    // Store project info in localStorage
    localStorage.setItem('current-project-id', newProject.id);
    localStorage.setItem('current-project-chunk', '0');
    localStorage.setItem('current-project-file-path', selected);
    localStorage.setItem('current-project-total-chunks', '1');
    localStorage.setItem('current-project-total-words', newProject.wordCount.toString());
    localStorage.setItem('current-project-chunk-size', newProject.wordCount.toString());

    setIsOpen(false);

    // Trigger event with file metadata
    window.dispatchEvent(new CustomEvent('file-loaded', {
      detail: {
        filePath: selected,
        id: newProject.id,
        chunkIndex: 0,
        totalChunks: 1,
        wordCount: newProject.wordCount,
        estimatedPages: newProject.estimatedPages
      }
    }));
  }, [projects, saveProjects]);

  const handleLoadProject = useCallback(async (project: FileProject) => {
    try {
      window.dispatchEvent(new CustomEvent('load-project-with-progress', {
        detail: { project }
      }));

      setIsOpen(false);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }, []);

  const handleDeleteProject = useCallback((projectId: string) => {
    const updatedProjects = ProjectManager.deleteProject(projectId, projects);
    saveProjects(updatedProjects);
  }, [projects, saveProjects]);

  // Collapsed view
  if (!isOpen) {
    return (
      <div className="fixed left-0 top-24 h-full w-16 bg-black/30 backdrop-blur-xl border-r border-white/20 flex flex-col items-center py-4 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            loadProjects();
            setIsOpen(true);
          }}
          className="text-white hover:bg-white/10 bg-black/20 backdrop-blur-sm border border-white/10 mb-4"
        >
          <FolderOpen className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="fixed left-0 top-8 h-full w-80 bg-black/30 backdrop-blur-xl border-r border-white/20 overflow-y-auto z-30">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-purple-900/10 to-pink-900/10" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/5 rounded-full blur-2xl animate-pulse delay-1000" />
      </div>

      <div className="relative p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">File Explorer</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="text-white hover:bg-white/10 bg-black/20 backdrop-blur-sm border border-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Open File Button */}
          <Card className="bg-black/20 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Open New File
              </CardTitle>
              <CardDescription className="text-white/70">
                Open a text file to start reading
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleOpenFile}
                className="w-full text-white bg-white/10 hover:bg-white/20 border-white/20 backdrop-blur-sm"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Open File
              </Button>
            </CardContent>
          </Card>

          <Separator className="bg-white/20" />

          {/* Projects List */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold text-sm">Saved Projects</h3>
            {projects.length === 0 ? (
              <div className="text-white/50 text-sm text-center py-8">
                No saved projects yet
              </div>
            ) : (
              projects.map((project) => (
                <Card
                  key={project.id}
                  className="bg-black/20 backdrop-blur-xl border-white/20 shadow-2xl cursor-pointer transition-all hover:bg-black/30"
                  onClick={() => handleLoadProject(project)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium text-sm">{project.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                        className="text-white/50 hover:text-white hover:bg-white/10 h-6 w-6"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                      <div
                        className="bg-white/30 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${UIUtils.getProgressPercentage(project)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span>{UIUtils.getProgressText(project)}</span>
                      <span>{UIUtils.formatDate(project.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};