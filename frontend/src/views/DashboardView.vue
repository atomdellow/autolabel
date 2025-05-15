<template>
  <div class="dashboard-view">
    <h1>Dashboard</h1>
    <div v-if="authStore.user">
      <p>Welcome, {{ authStore.user.username }}!</p>
    </div>

    <div class="project-creation">
      <h2>Create New Project</h2>
      <form @submit.prevent="handleCreateProject">
        <div>
          <label for="projectName">Project Name:</label>
          <input type="text" id="projectName" v-model="newProjectName" required />
        </div>
        <div>
          <label for="projectDescription">Description:</label>
          <textarea id="projectDescription" v-model="newProjectDescription"></textarea>
        </div>
        <div>
          <label for="projectModelType">Model Type:</label>
          <select id="projectModelType" v-model="newProjectModelType">
            <option value="Object Detection">Object Detection</option>
            <!-- Add other model types here in the future -->
          </select>
        </div>
        <button type="submit" :disabled="projectStore.isLoading">Create Project</button>
        <p v-if="projectStore.projectError" class="error">{{ projectStore.projectError }}</p>
      </form>
    </div>

    <div class="project-list">
      <h2>Your Projects</h2>
      <div v-if="projectStore.isLoading">Loading projects...</div>
      <div v-else-if="projectStore.projectError" class="error">
        Error loading projects: {{ projectStore.projectError }}
      </div>
      <ul v-else-if="projectStore.allProjects.length">
        <li v-for="project in projectStore.allProjects" :key="project._id" class="project-item">
          <router-link :to="{ name: 'ProjectDetail', params: { projectId: project._id } }">
            <h3>{{ project.name }}</h3>
            <p>{{ project.description }}</p>
            <p><small>Model Type: {{ project.modelType }}</small></p>
            <p><small>Created: {{ new Date(project.createdAt).toLocaleDateString() }}</small></p>
          </router-link>
          <button @click="handleDeleteProject(project._id)" :disabled="projectStore.isLoading" class="delete-button">
            Delete
          </button>
        </li>
      </ul>
      <p v-else>You don't have any projects yet. Create one above!</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const projectStore = useProjectStore();
const router = useRouter();

const newProjectName = ref('');
const newProjectDescription = ref('');
const newProjectModelType = ref('Object Detection'); // Default model type

onMounted(() => {
  projectStore.loadProjects();
});

const handleCreateProject = async () => {
  if (!newProjectName.value.trim()) {
    projectStore.error = "Project name is required."; // Directly set error or use a dedicated action
    return;
  }
  const projectData = {
    name: newProjectName.value,
    description: newProjectDescription.value,
    modelType: newProjectModelType.value,
  };
  const createdProject = await projectStore.createNewProject(projectData);
  if (createdProject) {
    newProjectName.value = '';
    newProjectDescription.value = '';
    // Optionally navigate to the new project's detail page
    // router.push({ name: 'ProjectDetail', params: { projectId: createdProject._id } });
  }
};

const handleDeleteProject = async (projectId) => {
  if (confirm('Are you sure you want to delete this project and all its data?')) {
    await projectStore.deleteExistingProject(projectId);
  }
};
</script>

<style scoped>
.dashboard-view {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
}

.project-creation {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.project-creation h2 {
  margin-top: 0;
}

.project-creation div {
  margin-bottom: 15px;
}

.project-creation label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.project-creation input[type="text"],
.project-creation textarea,
.project-creation select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.project-creation textarea {
  min-height: 80px;
  resize: vertical;
}

.project-creation button {
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.project-creation button:hover {
  background-color: #0056b3;
}

.project-creation button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.project-list {
  margin-top: 30px;
}

.project-list h2 {
  margin-bottom: 15px;
}

.project-list ul {
  list-style: none;
  padding: 0;
}

.project-item {
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 15px;
  transition: box-shadow 0.2s;
  position: relative; /* For positioning the delete button */
}

.project-item:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.project-item a {
  text-decoration: none;
  color: inherit;
  display: block; /* Make the whole item clickable */
}

.project-item h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #007bff;
}

.project-item p {
  margin-bottom: 5px;
  color: #555;
}

.project-item p small {
  color: #777;
}

.delete-button {
  position: absolute;
  top: 15px;
  right: 15px;
  padding: 8px 12px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.delete-button:hover {
  background-color: #c82333;
}

.delete-button:disabled {
  background-color: #ccc;
}

.error {
  color: red;
  margin-top: 10px;
}
</style>
