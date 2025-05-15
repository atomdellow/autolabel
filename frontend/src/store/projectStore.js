import { defineStore } from 'pinia';
import {
  getProjects as fetchProjects,
  createProject as addProject,
  deleteProject as removeProject,
  getProjectById as fetchProjectById,
  addProjectClass as updateProjectClass
} from '../services/projectService';

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [],
    currentProject: null,
    loading: false,
    error: null,
  }),
  getters: {
    allProjects: (state) => state.projects,
    isLoading: (state) => state.loading,
    projectError: (state) => state.error,
    selectedProject: (state) => state.currentProject,
  },
  actions: {
    async loadProjects() {
      this.loading = true;
      this.error = null;
      try {
        const projectsData = await fetchProjects();
        this.projects = projectsData;
      } catch (error) {
        this.error = error.message || 'Failed to load projects';
      } finally {
        this.loading = false;
      }
    },
    async loadProjectById(projectId) {
      this.loading = true;
      this.error = null;
      try {
        const projectData = await fetchProjectById(projectId);
        this.currentProject = projectData;
        return projectData;
      } catch (error) {
        this.error = error.message || `Failed to load project ${projectId}`;
        this.currentProject = null;
        return null;
      } finally {
        this.loading = false;
      }
    },
    async createNewProject(projectData) {
      this.loading = true;
      this.error = null;
      try {
        const newProject = await addProject(projectData);
        this.projects.push(newProject);
        return newProject;
      } catch (err) {
        if (err && err.message) { // err.message is from projectService.js (error.response.data)
            this.error = err.message;
        } else if (typeof err === 'string') {
            this.error = err;
        } else {
            this.error = 'An unexpected error occurred while creating the project.';
        }
        console.error('Error creating project in store:', err);
        return null;
      } finally {
        this.loading = false;
      }
    },
    async deleteExistingProject(projectId) {
      this.loading = true;
      this.error = null;
      try {
        await removeProject(projectId);
        this.projects = this.projects.filter(p => p._id !== projectId);
        if (this.currentProject && this.currentProject._id === projectId) {
          this.currentProject = null;
        }
      } catch (error) {
        this.error = error.message || 'Failed to delete project';
      } finally {
        this.loading = false;
      }
    },
    async addProjectClass(projectId, className) {
      try {
        const updatedProject = await updateProjectClass(projectId, className);
        this.currentProject = updatedProject;
        const index = this.projects.findIndex(p => p._id === projectId);
        if (index !== -1) {
          this.projects[index] = updatedProject;
        }
        return updatedProject;
      } catch (error) {
        console.error('Error adding project class:', error);
        throw error;
      }
    },
    clearCurrentProject() {
      this.currentProject = null;
    },
    clearError() {
      this.error = null;
    }
  },
});
