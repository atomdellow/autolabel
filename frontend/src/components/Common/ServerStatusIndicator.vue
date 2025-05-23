// filepath: c:\Users\adamd\Projects\autolabel\frontend\src\components\Common\ServerStatusIndicator.vue
<template>
  <div class="server-status-container">
    <div class="status-indicator" :class="statusClass">
      <div class="status-light"></div>
      <div class="status-text">
        Detection Server: {{ statusDisplayText }}
      </div>
    </div>
    
    <div v-if="showActions" class="server-actions">
      <button 
        class="action-button start-button" 
        @click="startServer" 
        :disabled="isLoading || status === 'running'"
      >
        <span v-if="isLoading" class="loader"></span>
        <span v-else>{{ status === 'running' ? 'Server Running' : 'Start Server' }}</span>
      </button>
      
      <button class="action-button refresh-button" @click="checkStatus" :disabled="isLoading">
        <span v-if="isLoading" class="loader"></span>
        <span v-else>Refresh Status</span>
      </button>
    </div>
    
    <div v-if="showDetails && message" class="status-details">
      <div class="status-message">{{ message }}</div>
      
      <div v-if="status === 'error' || status === 'stopped'" class="troubleshooting">
        <h4>Troubleshooting Tips:</h4>
        <ul>
          <li>Check if Python and required packages are installed</li>
          <li>Verify that the detection server is not blocked by a firewall</li>
          <li>Ensure the Python environment has all dependencies from requirements.txt</li>
          <li>Check the server logs for more details</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { checkServerStatus, startDetectionServer } from '@/services/detectionService';

export default {
  name: 'ServerStatusIndicator',
  
  props: {
    showActions: {
      type: Boolean,
      default: true
    },
    showDetails: {
      type: Boolean,
      default: true
    },
    autoRefresh: {
      type: Boolean,
      default: false
    },
    refreshInterval: {
      type: Number,
      default: 30000 // 30 seconds
    }
  },
  
  data() {
    return {
      status: 'unknown',
      message: '',
      serverUrl: '',
      isLoading: false,
      refreshTimer: null
    };
  },
  
  computed: {
    statusClass() {
      return {
        'running': this.status === 'running',
        'stopped': this.status === 'stopped',
        'error': this.status === 'error',
        'unknown': this.status === 'unknown'
      };
    },
    
    statusDisplayText() {
      switch(this.status) {
        case 'running':
          return 'Online';
        case 'stopped':
          return 'Offline';
        case 'error':
          return 'Error';
        default:
          return 'Checking...';
      }
    }
  },
  
  mounted() {
    this.checkStatus();
    
    if (this.autoRefresh) {
      this.startAutoRefresh();
    }
  },
  
  beforeUnmount() {
    this.stopAutoRefresh();
  },
  
  methods: {
    async checkStatus() {
      try {
        this.isLoading = true;
        const response = await checkServerStatus();
        
        this.status = response.status;
        this.message = response.message;
        this.serverUrl = response.serverUrl;
        
        this.$emit('status-updated', {
          status: this.status,
          message: this.message,
          serverUrl: this.serverUrl
        });
      } catch (error) {
        this.status = 'error';
        this.message = 'Failed to check server status';
        console.error('Error checking status:', error);
      } finally {
        this.isLoading = false;
      }
    },
    
    async startServer() {
      try {
        this.isLoading = true;
        const response = await startDetectionServer();
        
        this.status = response.status;
        this.message = response.message;
        
        if (response.status === 'started' || response.status === 'running') {
          this.$emit('server-started');
          // Check status again after a short delay to confirm server is running
          setTimeout(() => this.checkStatus(), 2000);
        }
      } catch (error) {
        this.status = 'error';
        this.message = 'Failed to start detection server';
        console.error('Error starting server:', error);
      } finally {
        this.isLoading = false;
      }
    },
    
    startAutoRefresh() {
      this.stopAutoRefresh(); // Clear any existing timer
      this.refreshTimer = setInterval(() => {
        this.checkStatus();
      }, this.refreshInterval);
    },
    
    stopAutoRefresh() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    }
  }
};
</script>

<style scoped>
.server-status-container {
  background-color: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.status-indicator {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.status-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: #999; /* Default/unknown */
}

.status-indicator.running .status-light {
  background-color: #4CAF50; /* Green */
  box-shadow: 0 0 8px #4CAF50;
}

.status-indicator.stopped .status-light {
  background-color: #FFC107; /* Amber */
}

.status-indicator.error .status-light {
  background-color: #F44336; /* Red */
}

.status-text {
  font-weight: 600;
  font-size: 0.95rem;
}

.server-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.action-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  height: 36px;
  transition: all 0.2s;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.start-button {
  background-color: #2196F3;
  color: white;
}

.start-button:hover:not(:disabled) {
  background-color: #1976D2;
}

.refresh-button {
  background-color: #E0E0E0;
  color: #212121;
}

.refresh-button:hover:not(:disabled) {
  background-color: #D0D0D0;
}

.status-details {
  margin-top: 12px;
  font-size: 0.9rem;
}

.status-message {
  margin-bottom: 10px;
  font-style: italic;
  color: #555;
}

.troubleshooting {
  background-color: #FFF8E1;
  border-left: 4px solid #FFB300;
  padding: 12px;
  border-radius: 0 4px 4px 0;
}

.troubleshooting h4 {
  margin-top: 0;
  margin-bottom: 8px;
  color: #F57F17;
}

.troubleshooting ul {
  margin: 0;
  padding-left: 20px;
}

.troubleshooting li {
  margin-bottom: 6px;
}

.loader {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
