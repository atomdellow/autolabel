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
      # Handle image dimensions - support both legacy mode and new width/height mode
    img_size = None
    if args.img_size is not None:
        img_size = args.img_size
        print(f"  Image Size: {img_size}x{img_size} (square - legacy mode)")
    else:
        img_size = [args.img_width, args.img_height]
        print(f"  Image Size: {args.img_width}x{args.img_height} (rectangular)")
    
    print(f"  YOLO Project: {args.yolo_project_name}")
    print(f"  YOLO Experiment: {args.yolo_experiment_name}")
    print(f"  Device: {args.device}")
    print(f"  Output Model Dir: {args.output_model_dir}")
    
    base_model_full_path = os.path.join(args.base_model_path, args.base_model_name)

    # Check if the base model file exists
    if not os.path.exists(base_model_full_path):
        print(f"Warning: Base model '{args.base_model_name}' not found in '{args.base_model_path}'.")
        print(f"Full path checked: {base_model_full_path}")
        print("Attempting to download the model via YOLO's auto-download mechanism...")
        try:
            # If the model doesn't exist, let YOLO try to download it from the official repository
            model = YOLO(args.base_model_name)
            print(f"Successfully downloaded and loaded model: {args.base_model_name}")
            base_model_full_path = args.base_model_name  # Use just the name for YOLO's auto-download
        except Exception as download_error:
            print(f"Error downloading model: {download_error}")
            print("Please ensure the model name is correct or manually download the model.")
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
        try:
            # First attempt with specified device (GPU or CPU)
            results = model.train(
                data=args.data_yaml_path,
                epochs=args.epochs,
                imgsz=img_size,  # This can be an int or [width, height]
                batch=args.batch_size,
                project=args.yolo_project_name, # This is YOLO's internal project for runs
                name=args.yolo_experiment_name,  # This is YOLO's internal experiment name
                device=args.device,
                exist_ok=True # Allows overwriting if the experiment name already exists
            )
        except Exception as cuda_error:
            if "torchvision::nms" in str(cuda_error) or "CUDA" in str(cuda_error):
                print(f"CUDA error detected: {cuda_error}")
                print("Falling back to CPU training...")
                # Retry with CPU
                results = model.train(
                    data=args.data_yaml_path,
                    epochs=args.epochs,
                    imgsz=img_size,  
                    batch=args.batch_size,                    project=args.yolo_project_name,
                    name=args.yolo_experiment_name,
                    device="cpu",
                    exist_ok=True
                )
            else:
                # If it's not a CUDA error, re-raise
                raise
        
        print("Training completed!")
        print(f"YOLO training results saved to: {results.save_dir}")
        
        # Check for model files in the expected YOLO output directory
        best_model_source_path = os.path.join(results.save_dir, 'weights', 'best.pt')
        last_model_source_path = os.path.join(results.save_dir, 'weights', 'last.pt')
        
        # Define output model paths with project-specific names
        model_name_base = f"{args.yolo_project_name}_{args.yolo_experiment_name}"
        output_best_model_path = os.path.join(args.output_model_dir, f"{model_name_base}_best.pt")
        output_last_model_path = os.path.join(args.output_model_dir, f"{model_name_base}_last.pt")
        
        models_saved = False
        
        # Try to copy the best model if it exists
        if os.path.exists(best_model_source_path):
            try:
                shutil.copy2(best_model_source_path, output_best_model_path)
                print(f"Best model saved to: {output_best_model_path}")
                models_saved = True
            except Exception as copy_error:
                print(f"Error copying best model: {copy_error}")
        else:
            print(f"Best model not found at expected path: {best_model_source_path}")
        
        # Try to copy the last model as a backup if it exists
        if os.path.exists(last_model_source_path):
            try:
                shutil.copy2(last_model_source_path, output_last_model_path)
                print(f"Last model saved to: {output_last_model_path}")
                models_saved = True
            except Exception as copy_error:
                print(f"Error copying last model: {copy_error}")
        
        # If no model files were copied, look for any .pt files in the run directory as a fallback
        if not models_saved:
            print("No model files found in expected locations. Searching for alternatives...")
            try:
                # Look for any .pt files in the run directory structure
                for root, dirs, files in os.walk(results.save_dir):
                    for file in files:
                        if file.endswith('.pt'):
                            found_model_path = os.path.join(root, file)
                            fallback_output_path = os.path.join(args.output_model_dir, f"{model_name_base}_{file}")
                            shutil.copy2(found_model_path, fallback_output_path)
                            print(f"Found and copied model from {found_model_path} to {fallback_output_path}")
                            models_saved = True
            except Exception as search_error:
                print(f"Error searching for alternative model files: {search_error}")
        
        if not models_saved:
            print("WARNING: No model files were found or copied. Training may have failed to produce a model.")

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
    
    # Image size parameters - supporting both legacy mode and width/height mode
    parser.add_argument('--img_width', type=int, default=640, help='Image width for training (rectangular mode).')
    parser.add_argument('--img_height', type=int, default=640, help='Image height for training (rectangular mode).')
    parser.add_argument('--img_size', type=int, default=None, help='Square image size (legacy mode). If specified, overrides width/height.')
    
    parser.add_argument('--yolo_project_name', type=str, default='YOLOv8_Custom_Training', help="Project name for YOLO's run output structure.")
    parser.add_argument('--yolo_experiment_name', type=str, default='experiment1', help="Experiment name for YOLO's run output structure.")
    parser.add_argument('--device', type=str, default=None, help="Device to train on: 'cpu', 'cuda', or 'mps'. Auto-detects if None.")
    parser.add_argument('--output_model_dir', type=str, required=True, help="Directory to save the final 'best.pt' model.")

    args = parser.parse_args()
    
    # Auto-detect device if not specified
    if args.device is None:
        args.device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    
    # This ensures the training process starts only when the script is executed directly.
    train_model(args)
    # Example of how to run this script from the terminal:
    # python train_yolo.py --data_yaml_path /path/to/your/data.yaml --output_model_dir /path/to/save/models --base_model_path /path/to/yolov8n_pt_file_directory
    # If yolov8n.pt is in the same directory as train_yolo.py:
    # python train_yolo.py --data_yaml_path C:\Users\adamd\Projects\autolabel\AutoDesktopApplication\UI_Element_Dataset\data.yaml --output_model_dir C:\Users\adamd\Projects\autolabel\backend\trained_models --base_model_path C:\Users\adamd\Projects\autolabel\AutoDesktopVisionApi
