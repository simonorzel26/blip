import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

export type FileMetadata = {
  id: string;
  filename: string;
  saved_path: string;
  total_words: number;
  current_word_index: number;
  created_at: string;
};

export type ProjectSettings = {
  time_per_word: number;
  time_per_character: number;
  highlight_orp: boolean;
  letter_spacing: number;
  punctuation_delay: number;
  trail_words_count: number;
  chunk_size: number;
  skill_level: number;
  normalize_text: boolean;
};

export type ProjectSession = {
  session_id: string;
  project_id: string;
  current_word_index: number;
  last_read_date: string;
  settings: ProjectSettings;
};

export class TauriFileAPI {
  static async pickAndImportFile(): Promise<FileMetadata | null> {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
      });

      if (!selected || Array.isArray(selected)) return null;

      const metadata = await invoke<FileMetadata>('import_file', {
        originalPath: selected,
      });

      // Save the project metadata
      await this.saveProjectMetadata(metadata);

      return metadata;
    } catch (error) {
      console.error('Failed to pick and import file:', error);
      return null;
    }
  }

  static async loadWordBuffer(
    path: string,
    startIndex: number,
    bufferSize = 1000
  ): Promise<string[]> {
    try {
      return await invoke<string[]>('load_word_buffer', {
        path,
        startIndex,
        bufferSize,
      });
    } catch (error) {
      console.error('Failed to load word buffer:', error);
      return [];
    }
  }

  static async saveProjectMetadata(metadata: FileMetadata): Promise<void> {
    try {
      await invoke('save_project_metadata', { metadata });
    } catch (error) {
      console.error('Failed to save project metadata:', error);
    }
  }

  static async loadProjects(): Promise<FileMetadata[]> {
    try {
      return await invoke<FileMetadata[]>('load_projects');
    } catch (error) {
      console.error('Failed to load projects:', error);
      return [];
    }
  }

  static async deleteProject(projectId: string): Promise<void> {
    try {
      await invoke('delete_project', { projectId });
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  static async saveSessionProgress(projectId: string, wordIndex: number): Promise<void> {
    try {
      await invoke('save_session_progress', {
        projectId,
        wordIndex,
      });
    } catch (error) {
      console.error('Failed to save session progress:', error);
    }
  }

  static async loadSessionProgress(projectId: string): Promise<number | null> {
    try {
      const result = await invoke<number | null>('load_session_progress', {
        projectId,
      });
      return result;
    } catch (error) {
      console.error('Failed to load session progress:', error);
      return null;
    }
  }

    static async updateProjectProgress(
    metadata: FileMetadata,
    currentWordIndex: number
  ): Promise<void> {
    try {
      const updatedMetadata = {
        ...metadata,
        current_word_index: currentWordIndex,
      };

      await Promise.all([
        this.saveProjectMetadata(updatedMetadata),
        this.saveSessionProgress(metadata.id, currentWordIndex),
      ]);
    } catch (error) {
      console.error('Failed to update project progress:', error);
    }
  }

  static async saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    try {
      await invoke('save_project_settings', {
        projectId,
        settings,
      });
    } catch (error) {
      console.error('Failed to save project settings:', error);
    }
  }

  static async loadProjectSettings(projectId: string): Promise<ProjectSettings | null> {
    try {
      return await invoke<ProjectSettings | null>('load_project_settings', {
        projectId,
      });
    } catch (error) {
      console.error('Failed to load project settings:', error);
      return null;
    }
  }

  static getDefaultSettings(): ProjectSettings {
    return {
      time_per_word: 35, // Word delay: 35ms default
      time_per_character: 25, // Character delay: 25ms default
      highlight_orp: true,
      letter_spacing: 3.5,
      punctuation_delay: 50, // Punctuation delay: 50ms default
      trail_words_count: 8,
      chunk_size: 1,
      skill_level: 1,
      normalize_text: false,
    };
  }
}