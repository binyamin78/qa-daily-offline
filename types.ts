
export interface FormData {
  projectName: string;
  version: string;
  checkedAreas: string;
  newJiraBugs: string;
  blockers: string;
  openIssues: string;
  estimatedCompletion: string;
  progressPercentage: string;
}

export interface AppSettings {
  defaultVersion: string;
  customProjects: string[];
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  projectName: string;
  text: string;
}
