from ultralytics import YOLO
import os
import torch
import argparse
import shutil

# --- Configuration via Command-Line Arguments ---
# Values will be set by parsing arguments

def train_model(args):
    """
    Loads the YOLO model, trains it on the custom dataset, and saves the results.
    """
    print(f"Starting training with the following configuration:")
    print(f"  Data YAML: {args.data_yaml_path}")
    print(f"  Base Model Name: {args.base_model_name}")
    print(f"  Base Model Path: {args.base_model_path}")
    print(f"  Epochs: {args.epochs}")
    print(f"  Batch Size: {args.batch_size}")
    print(f"  Image Size: {args.img_size}")
    print(f"  YOLO Project: {args.yolo_project_name}")
    print(f"  YOLO Experiment: {args.yolo_experiment_name}")
    print(f"  Device: {args.device}")
    print(f"  Output Model Dir: {args.output_model_dir}")

    base_model_full_path = os.path.join(args.base_model_path, args.base_model_name)

    # Check if the base model file exists
    if not os.path.exists(base_model_full_path):
        print(f"Error: Base model '{args.base_model_name}' not found in '{args.base_model_path}'.")
        print(f"Full path checked: {base_model_full_path}")
        print("Please ensure the .pt file is in the specified path or update the arguments.")
        return

    # Check if the data.yaml file exists
    if not os.path.exists(args.data_yaml_path):
        print(f"Error: data.yaml not found at '{args.data_yaml_path}'.")
        print("Please verify the data_yaml_path argument.")
        return
    
    # Ensure output model directory exists
    os.makedirs(args.output_model_dir, exist_ok=True)

    try:
        # Load the YOLO model.
        model = YOLO(base_model_full_path)
        print(f"Successfully loaded base model: {base_model_full_path}")

        # Train the model
        print("Starting model training...")
        results = model.train(
            data=args.data_yaml_path,
            epochs=args.epochs,
            imgsz=args.img_size,
            batch=args.batch_size,
            project=args.yolo_project_name, # This is YOLO's internal project for runs
            name=args.yolo_experiment_name,  # This is YOLO's internal experiment name
            device=args.device,
            exist_ok=True # Allows overwriting if the experiment name already exists
        )
        
        print("Training completed!")
        print(f"YOLO training results saved to: {results.save_dir}")
        
        best_model_source_path = os.path.join(results.save_dir, 'weights', 'best.pt')
        
        if os.path.exists(best_model_source_path):
            # Determine a unique name for the output model, perhaps incorporating project/experiment or a timestamp
            # For now, let's use a generic name or allow it to be specified.
            # We'll save it as project_experiment_best.pt in the output_model_dir
            output_model_filename = f"{args.yolo_project_name}_{args.yolo_experiment_name}_best.pt"
            output_model_destination_path = os.path.join(args.output_model_dir, output_model_filename)
            
            shutil.copy2(best_model_source_path, output_model_destination_path)
            print(f"The best model has been copied to: {output_model_destination_path}")
        else:
            print(f"Error: Could not find 'best.pt' at {best_model_source_path}")

    except Exception as e:
        print(f"An error occurred during training: {e}")
        print("Please check your dataset, configuration, and environment.")
        if "out of memory" in str(e).lower():
            print("Suggestion: Try reducing BATCH_SIZE or IMG_SIZE if you encountered an out-of-memory error.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train a YOLOv8 model.")
    
    parser.add_argument('--data_yaml_path', type=str, required=True, help='Path to your data.yaml file.')
    parser.add_argument('--base_model_name', type=str, default='yolov8n.pt', help="Name of the pre-trained model file (e.g., 'yolov8n.pt').")
    parser.add_argument('--base_model_path', type=str, default='.', help="Directory where the base_model_name is located.")
    parser.add_argument('--epochs', type=int, default=50, help='Number of training epochs.')
    parser.add_argument('--batch_size', type=int, default=8, help='Batch size for training.')
    parser.add_argument('--img_size', type=int, default=640, help='Image size for training (e.g., 640).')
    parser.add_argument('--yolo_project_name', type=str, default='YOLOv8_Custom_Training', help="Project name for YOLO's run output structure (e.g., 'runs/detect/PROJECT_NAME').")
    parser.add_argument('--yolo_experiment_name', type=str, default='experiment1', help="Experiment name for YOLO's run output structure (e.g., 'runs/detect/PROJECT_NAME/EXPERIMENT_NAME').")
    parser.add_argument('--device', type=str, default=None, help="Device to train on: 'cpu', 'cuda', or 'mps'. Auto-detects if None.")
    parser.add_argument('--output_model_dir', type=str, required=True, help="Directory to save the final 'best.pt' model.")

    args = parser.parse_args()

    if args.device is None:
        args.device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    
    # This ensures the training process starts only when the script is executed directly.
    train_model(args)
    # Example of how to run this script from the terminal:
    # python train_yolo.py --data_yaml_path /path/to/your/data.yaml --output_model_dir /path/to/save/models --base_model_path /path/to/yolov8n_pt_file_directory
    # If yolov8n.pt is in the same directory as train_yolo.py:
    # python train_yolo.py --data_yaml_path C:\Users\adamd\Projects\autolabel\AutoDesktopApplication\UI_Element_Dataset\data.yaml --output_model_dir C:\Users\adamd\Projects\autolabel\backend\trained_models --base_model_path C:\Users\adamd\Projects\autolabel\AutoDesktopVisionApi
