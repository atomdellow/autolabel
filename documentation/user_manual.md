# AutoLabel User Manual

## 1. Introduction

### 1.1. Purpose of AutoLabel
AutoLabel is a full-stack web application designed to streamline the process of image labeling and annotation for machine learning models. It provides an intuitive interface for managing projects, uploading images, annotating objects within those images, and initiating model training, initially focusing on Object Detection with YOLOv8.

### 1.2. Key Features
*   **Project Management:** Create and organize labeling projects.
*   **Image Handling:** Upload, view, and manage images within projects.
*   **Class Management:** Define and manage object classes for annotation.
*   **Annotation Tools:** User-friendly editor for drawing bounding box annotations.
    *   Pan and Zoom (if implemented)
    *   Undo/Redo functionality
*   **Image Tagging:** Add descriptive tags to images for better organization and filtering.
*   **Model Training:** Initiate YOLOv8 model training using annotated data.
*   **User Authentication:** Secure access to your projects and data.

## 2. Getting Started

### 2.1. System Requirements
*   A modern web browser (e.g., Chrome, Firefox, Edge, Safari).
*   Internet connection.

### 2.2. Accessing AutoLabel
AutoLabel is a web application. You can access it by navigating to the provided URL once it's deployed.

### 2.3. Account Creation
1.  Navigate to the AutoLabel application URL.
2.  Click on the "Register" or "Sign Up" link.
3.  Fill in the required information:
    *   Username
    *   Password
    *   (Confirm Password, if applicable)
4.  Click "Register". You should be automatically logged in or redirected to the login page.

### 2.4. Logging In
1.  Navigate to the AutoLabel application URL.
2.  Click on the "Login" link.
3.  Enter your Username and Password.
4.  Click "Login". You will be redirected to your dashboard.

## 3. User Interface Overview

### 3.1. Dashboard
The Dashboard is the main landing page after logging in. It displays:
*   A list of your existing projects.
*   Options to create a new project.
*   A navigation bar, typically at the top, providing access to:
    *   Dashboard/Projects link
    *   Logout button

### 3.2. Project Detail View
Accessed by clicking on a project from the Dashboard. This view shows:
*   Project name and description.
*   **Image Management Section:**
    *   List of uploaded images (thumbnails or names).
    *   Option to upload new images.
    *   For each image: options to view, annotate, or delete (if implemented).
    *   Image tagging interface.
*   **Class Management Section:**
    *   List of defined classes for the project.
    *   Option to add new classes.
    *   Option to remove existing classes.
*   **Model Training Section:**
    *   Button to start the training process.
    *   Display of current training status (e.g., Not Trained, In Progress, Completed, Failed).
    *   Link to download the trained model (if training is complete and successful).
    *   Training logs or progress indicators.

### 3.3. Annotation Editor View
Accessed by selecting an image for annotation from the Project Detail View. This view includes:
*   **Main Canvas:** Displays the image to be annotated.
*   **Toolbar:** Contains tools for:
    *   Selecting annotation mode (e.g., bounding box).
    *   Pan (if implemented).
    *   Zoom In/Out (if implemented).
    *   Undo/Redo annotation actions.
*   **Class Selection Panel:** A dropdown or list to select the class for the current annotation.
*   **Annotation List (Optional):** A panel showing existing annotations for the current image.
*   **Save/Done Button:** To save annotations and return to the project view.
*   **Navigation:** Link to go back to the Project Detail view.

## 4. Core Workflows

### 4.1. Account Management

#### 4.1.1. Registration
(Covered in 2.3. Account Creation)

#### 4.1.2. Login
(Covered in 2.4. Logging In)

#### 4.1.3. Logout
1.  Locate the "Logout" button, usually in the main navigation bar.
2.  Click "Logout". You will be logged out and typically redirected to the login or home page.

### 4.2. Project Management

#### 4.2.1. Creating a New Project
1.  From the Dashboard, click the "Create New Project" button.
2.  A modal or form will appear. Enter:
    *   **Project Name:** A descriptive name for your project.
    *   **Project Description (Optional):** More details about the project.
3.  Click "Create" or "Save". The new project will appear in your project list.

#### 4.2.2. Viewing Project Details
1.  From the Dashboard, find the project you want to view in the list.
2.  Click on the project card or name. You will be taken to the Project Detail View.

*(Future: Editing Project Details, Deleting a Project - if implemented)*

### 4.3. Class Management (within a Project)

#### 4.3.1. Adding a New Class
1.  Navigate to the Project Detail View for the desired project.
2.  Locate the "Class Management" or "Classes" section.
3.  Enter the name of the new class in the input field (e.g., "cat", "car", "person").
4.  Click the "Add Class" button. The new class will appear in the list of project classes.

#### 4.3.2. Removing a Class
1.  In the Project Detail View, find the class you wish to remove in the class list.
2.  Click the "Delete" or "Remove" icon/button associated with that class.
3.  Confirm the deletion if prompted. The class will be removed.
    *Note: Ensure no existing annotations use this class before removing, or understand how the system handles such cases.*

### 4.4. Image Management (within a Project)

#### 4.4.1. Uploading Images
1.  Navigate to the Project Detail View.
2.  Find the "Image Management" or "Images" section.
3.  Click the "Upload Image(s)" button.
4.  A file dialog will open. Select one or more images from your computer.
    *Supported formats typically include .jpg, .jpeg, .png.*
5.  The selected images will be uploaded to the project. They will appear in the image list.

#### 4.4.2. Viewing Images
Images are typically displayed as thumbnails or a list in the Project Detail View. Clicking an image or an "Annotate" button associated with it will open it in the Annotation Editor.

#### 4.4.3. Image Tagging
1.  In the Project Detail View, locate the image you want to tag.
2.  There should be an input field or interface near each image for adding tags.
3.  Type a tag (e.g., "outdoor", "night-time", "blurry") and press Enter or click an "Add Tag" button.
4.  Tags can help in organizing and later filtering images (if filtering is implemented).
5.  To remove a tag, there's usually a small 'x' or delete icon next to the tag.

*(Future: Deleting Images - if implemented)*

### 4.5. Annotation Process

#### 4.5.1. Opening the Annotation Editor
1.  From the Project Detail View, select an image you wish to annotate.
2.  Click on the image thumbnail or an "Annotate" button next to it. This will load the Annotation Editor View with the selected image.

#### 4.5.2. Selecting a Class
1.  In the Annotation Editor, locate the "Class Selection" panel.
2.  Choose the object class you are about to annotate from the dropdown list (e.g., if you are about to draw a box around a cat, select "cat"). This class will be associated with the next annotation you create.

#### 4.5.3. Drawing Bounding Boxes
1.  Ensure the bounding box tool is active (usually by default).
2.  On the image canvas:
    *   Click and hold the left mouse button at one corner of the object you want to annotate.
    *   Drag the mouse to the opposite corner, drawing a rectangle around the object.
    *   Release the mouse button.
3.  The bounding box will be drawn, and its details (class, coordinates) are typically saved automatically or upon a specific save action.

#### 4.5.4. Modifying Annotations (if implemented)
*   **Selecting an annotation:** Click on an existing bounding box on the canvas.
*   **Resizing:** Drag the handles of a selected bounding box.
*   **Moving:** Click and drag the body of a selected bounding box.
*   **Changing class:** Select an annotation, then choose a new class from the class panel.
*   **Deleting an annotation:** Select an annotation, then press a "Delete" key or click a delete button in the UI.

#### 4.5.5. Using Undo/Redo
*   **Undo:** If you make a mistake (e.g., draw a box incorrectly), click the "Undo" button in the toolbar. This will revert the last annotation action.
*   **Redo:** If you undid an action by mistake, click the "Redo" button. This will reapply the action you undid.

#### 4.5.6. Saving Annotations
Annotations are often saved automatically as you create or modify them. If there's an explicit "Save Annotations" button, click it before leaving the editor to ensure all changes are stored.

#### 4.5.7. Navigating Between Images (if implemented)
Some editors might have "Next Image" / "Previous Image" buttons to quickly move between images in the project without returning to the Project Detail View.

### 4.6. Model Training

#### 4.6.1. Prerequisites for Training
*   A project must have at least one class defined.
*   The project must have a sufficient number of images uploaded.
*   A significant portion of these images must have annotations for the defined classes. The more high-quality annotations, the better the model.

#### 4.6.2. Starting the Training Process
1.  Navigate to the Project Detail View for the project you want to train.
2.  Locate the "Model Training" section.
3.  Click the "Start Training" button.
4.  The system will begin preparing your data and initiating the training script (e.g., YOLOv8).

#### 4.6.3. Monitoring Training Status
*   The "Training Status" in the Project Detail View will update to reflect the current state:
    *   **Not Trained:** No training has been attempted or completed.
    *   **In Progress:** Training is currently active.
    *   **Completed:** Training finished successfully.
    *   **Failed:** Training encountered an error and did not complete.
*   Training logs or console output might be displayed in this section or accessible via a link, providing more details about the training progress.

#### 4.6.4. Accessing Trained Models
*   If training status is "Completed", a download link for the trained model (e.g., `best.pt` for YOLOv8) should appear in the "Model Training" section.
*   Click the link to download the model file to your computer for use in your inference applications.

## 5. Troubleshooting

### 5.1. Unable to Login
*   **Incorrect Credentials:** Double-check your username and password. Ensure Caps Lock is off.
*   **Account Not Registered:** If you haven't registered, create an account first.
*   **Server Issues:** The application server might be temporarily down. Try again later or contact support.

### 5.2. Image Upload Fails
*   **File Format:** Ensure images are in a supported format (JPG, PNG).
*   **File Size:** There might be a limit on image file size. Try smaller images.
*   **Network Issues:** Check your internet connection.
*   **Server Storage:** The server might be out of storage space (admin issue).

### 5.3. Annotations Not Saving
*   **Network Interruption:** Ensure your internet connection is stable.
*   **Class Not Selected:** Make sure you have a class selected before drawing an annotation.
*   **Browser Issues:** Try clearing your browser cache or using a different browser.

### 5.4. Training Fails
*   **Insufficient Data:** Not enough images or annotations. YOLOv8 requires a minimum amount of data for both training and validation sets. Ensure you have enough annotated images (e.g., at least a few images per class, with multiple instances if possible). The system attempts to create a validation split; if you have very few images (e.g., <5), it tries to use them for both, but more data is always better.
*   **No Classes Defined:** Training cannot start without defined classes.
*   **Annotation Errors:** Inconsistent or incorrect annotations (e.g., boxes that don't properly enclose objects).
*   **Server-Side Issues:** The training script might encounter errors on the server (e.g., resource limits, Python environment problems). Check training logs if available, or contact support.
*   **Image Dimensions:** Ensure images have valid dimensions. The training script might fail if image metadata (width, height) is missing or zero, as this is used for normalizing annotation coordinates.

## 6. Frequently Asked Questions (FAQ)

*   **Q: What is YOLOv8?**
    *   A: YOLOv8 is the latest version of the "You Only Look Once" real-time object detection system. AutoLabel uses it as the initial model for training.
*   **Q: Can I use a different model for training?**
    *   A: Currently, AutoLabel is configured for YOLOv8. Future versions might support other models.
*   **Q: How many images do I need to train a good model?**
    *   A: This varies greatly depending on the complexity of the objects and the desired accuracy. Generally, more data is better. Start with at least 20-50 high-quality annotated images per class for initial results, and aim for hundreds or thousands for robust models.
*   **Q: Where is my data stored?**
    *   A: Your project information, image metadata, and annotations are stored in a MongoDB database. Uploaded images are stored on the server's file system.
*   **Q: Is my data secure?**
    *   A: AutoLabel uses JWT-based authentication to protect user accounts and data. Ensure you use a strong password.

## 7. Contact / Support

*(Placeholder: Provide contact email, link to a support forum, or other ways to get help.)*

---
*This user manual is a living document and will be updated as AutoLabel evolves.*
