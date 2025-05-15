import apiClient from './api';

export const getProjects = async () => {
  try {
    const response = await apiClient.get('/projects');
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getProjectById = async (projectId) => {
  try {
    const response = await apiClient.get(`/projects/${projectId}`);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const createProject = async (projectData) => {
  try {
    const response = await apiClient.post('/projects', projectData);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const updateProject = async (projectId, projectData) => {
  try {
    const response = await apiClient.put(`/projects/${projectId}`, projectData);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteProject = async (projectId) => {
  try {
    const response = await apiClient.delete(`/projects/${projectId}`);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const addProjectClass = async (projectId, className) => {
  try {
    const response = await apiClient.put(`/projects/${projectId}/classes`, { className });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteProjectClass = async (projectId, className) => {
  try {
    const response = await apiClient.delete(`/projects/${projectId}/classes`, { data: { className } });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};
