
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
  defaultProjectName: string;
  defaultVersion: string;
  customProjects: string[];
}
