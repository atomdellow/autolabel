import argparse
import os
import sys
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Train YOLOv8 model.")
    parser.add_argument('--data', type=str, required=True, help='Path to the dataset YAML file.')
    parser.add_argument('--weights', type=str, default='yolov8n.pt', help='Initial weights file (e.g., yolov8n.pt).')
    parser.add_argument('--epochs', type=int, default=50, help='Number of training epochs.')
    parser.add_argument('--img', type=int, default=640, help='Image size for training.')
    parser.add_argument('--project_id', type=str, required=True, help='Project ID, used for naming the output subdirectory.')
    parser.add_argument('--output_dir', type=str, required=True, help='Base directory to save training runs.')
    # Add any other YOLOv8 specific arguments you might need, e.g., batch_size, device

    args = parser.parse_args()

    print("--- Starting YOLOv8 Training Script ---")
    print(f"Received arguments: {args}")

    try:
        from ultralytics import YOLO

        # Initialize YOLO model
        # If args.weights is just a name like 'yolov8n.pt', it will download if not present.
        # If it's a path to a local .pt file, it will use that.
        model = YOLO(args.weights)

        print(f"Successfully initialized YOLO model with weights: {args.weights}")

        # Define project and name for saving results
        # Results will be saved to: output_dir/project_id/
        # e.g., backend/trained_models/some_project_id_from_db/
        # Inside this, YOLO will create structure like 'weights/best.pt'
        
        print(f"Training data path: {args.data}")
        print(f"Output project directory: {args.output_dir}")
        print(f"Experiment name (subdirectory): {args.project_id}")

        # Start training
        # The `project` argument in model.train() specifies the directory for all experiments.
        # The `name` argument specifies the name of the current experiment's subfolder.
        results = model.train(
            data=args.data,
            epochs=args.epochs,
            imgsz=args.img,
            project=args.output_dir, # Base directory for all runs
            name=args.project_id,   # Subdirectory for this specific project's run
            exist_ok=True,          # Overwrite if 'output_dir/project_id' already exists
            # patience=5, # Example: early stopping
            # batch=16,   # Example: batch size
            # device='0'  # Example: specify GPU device, or 'cpu'
        )
        
        # The best model is typically saved as 'best.pt' in the experiment directory
        # results.save_dir should point to 'output_dir/project_id'
        best_model_path = Path(results.save_dir) / 'weights' / 'best.pt'

        print(f"--- YOLOv8 Training Completed ---")
        print(f"Results saved to: {results.save_dir}")
        if best_model_path.exists():
            print(f"Best model saved at: {best_model_path}")
            # You could also copy this best model to a more predictable top-level location if desired
            # e.g., shutil.copy(best_model_path, Path(args.output_dir) / f"{args.project_id}_best.pt")
        else:
            print(f"Best model (best.pt) not found in {Path(results.save_dir) / 'weights'}. Check training logs.")
            # List contents of save_dir for debugging
            if Path(results.save_dir).exists():
                print(f"Contents of {results.save_dir}: {list(Path(results.save_dir).glob('**/*'))}")


    except ImportError:
        print("Error: The 'ultralytics' package is not installed. Please install it (e.g., pip install ultralytics).", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred during training: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
