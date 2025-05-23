// This file serves as a test script to validate training with rectangular dimensions
// Run the following from command line (assuming Python environment is set up):
// python train_yolo.py --data_yaml_path path_to_data.yaml --img_width 640 --img_height 480 --output_model_dir output_dir

// Command to verify the changes:
// python -c "import sys; sys.path.append('c:/Users/adamd/Projects/autolabel/AutoDesktopVisionApi'); import train_yolo; print('Arguments parsed successfully')"

// Example 1: Using rectangular dimensions (new mode)
// python train_yolo.py --data_yaml_path path_to_data.yaml --img_width 1280 --img_height 720 --output_model_dir trained_models

// Example 2: Using legacy square dimensions
// python train_yolo.py --data_yaml_path path_to_data.yaml --img_size 640 --output_model_dir trained_models

// Example 3: Full command with all parameters
// python train_yolo.py --data_yaml_path path_to_data.yaml --base_model_name yolov8n.pt --base_model_path . --epochs 50 --batch_size 8 --img_width 1920 --img_height 1080 --device cuda --output_model_dir trained_models
