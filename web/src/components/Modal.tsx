import React, { useState } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";
import "./Modal.css";

export type ModalMode = "form" | "preview" | "view";

interface ModalProps {
  isOpen: boolean;
  mode?: ModalMode;
  title: string;
  onClose: () => void;
  onLeftAction?: () => void;
  onRightAction?: ((e: React.FormEvent) => void | Promise<void>) | (() => void);
  leftButtonText?: string;
  rightButtonText?: string;
  leftButtonDisabled?: boolean;
  rightButtonDisabled?: boolean;
  leftButtonClass?: string;
  rightButtonClass?: string;
  children: React.ReactNode;
  headerSection?: React.ReactNode; // Optional section above main content (e.g., image)
  showLeftButton?: boolean;
  showRightButton?: boolean;
  showDeleteButton?: boolean;
  confirmBeforeDelete?: boolean; // Whether to confirm before delete action
  onDeleteAction?: () => void;
  deleteButtonText?: string;
  deleteButtonDisabled?: boolean;
  deleteButtonClass?: string;
  maxWidth?: string; // Custom max width
  showAdditionalButton?: boolean;
  onAdditionalAction?: () => void;
  additionalButtonText?: string;
  additionalButtonClass?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  mode = "form",
  title,
  onClose,
  onLeftAction = onClose,
  onRightAction,
  leftButtonText = "Cancel",
  rightButtonText = "Submit",
  leftButtonDisabled = false,
  rightButtonDisabled = false,
  leftButtonClass = "cancel-btn",
  rightButtonClass = "submit-btn",
  children,
  headerSection,
  showLeftButton = true,
  showRightButton = true,
  showDeleteButton = false,
  confirmBeforeDelete = true,
  onDeleteAction,
  deleteButtonText = "Delete",
  deleteButtonDisabled = false,
  deleteButtonClass = "delete-btn",
  maxWidth = "600px",
  showAdditionalButton = false,
  onAdditionalAction,
  additionalButtonText = "Additional",
  additionalButtonClass = "additional-btn",
}) => {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onRightAction) {
      (onRightAction as (e: React.FormEvent) => void | Promise<void>)(e);
    }
  };

  const handleRightButtonClick = () => {
    if (onRightAction) {
      (onRightAction as () => void)();
    }
  };

  const handleDeleteClick = () => {
    if (confirmBeforeDelete) {
      setShowDeleteConfirmation(true);
    } else {
      handleDeleteConfirm();
    }
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirmation(false);
    if (onDeleteAction) {
      onDeleteAction();
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirmation(false);
  };

  const isFormMode = mode === "form";

  const modalContent = (
    <div className="modal-overlay">
      <div
        className={`modal-content ${mode === "preview" ? "modal-preview" : ""}`}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {isFormMode ? (
            <form onSubmit={handleFormSubmit} className="modal-form">
              <div className="form-content">
                {headerSection && (
                  <div className="form-group">
                    {headerSection}
                    {showAdditionalButton && onAdditionalAction && (
                      <button
                        type="button"
                        className={additionalButtonClass}
                        onClick={onAdditionalAction}
                      >
                        {additionalButtonText}
                      </button>
                    )}
                  </div>
                )}
                {children}
              </div>
              <div className="form-actions">
                <div className="form-actions-main">
                  {showLeftButton && onLeftAction && (
                    <button
                      type="button"
                      onClick={onLeftAction}
                      disabled={leftButtonDisabled}
                      className={leftButtonClass}
                    >
                      {leftButtonText}
                    </button>
                  )}
                  {showRightButton && (
                    <button
                      type="submit"
                      disabled={rightButtonDisabled}
                      className={rightButtonClass}
                    >
                      {rightButtonText}
                    </button>
                  )}
                </div>
                {showDeleteButton && onDeleteAction && (
                  <div className="form-actions-delete">
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={deleteButtonDisabled}
                      className={deleteButtonClass}
                    >
                      {deleteButtonText}
                    </button>
                  </div>
                )}
              </div>
            </form>
          ) : (
            // Preview/View mode
            <div className="modal-preview-content">
              {headerSection}
              {children}
              <div className="form-actions">
                <div className="form-actions-main">
                  {showLeftButton && onLeftAction && (
                    <button
                      type="button"
                      onClick={onLeftAction}
                      disabled={leftButtonDisabled}
                      className={leftButtonClass}
                    >
                      {leftButtonText}
                    </button>
                  )}
                  {showRightButton && (
                    <button
                      type="button"
                      onClick={handleRightButtonClick}
                      disabled={rightButtonDisabled}
                      className={rightButtonClass}
                    >
                      {rightButtonText}
                    </button>
                  )}
                </div>
                {showDeleteButton && onDeleteAction && (
                  <div className="form-actions-delete">
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={deleteButtonDisabled}
                      className={deleteButtonClass}
                    >
                      {deleteButtonText}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const confirmationDialog = (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Confirm Delete</h2>
          <button className="close-btn" onClick={handleDeleteCancel}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete this item? This action cannot be
            undone.
          </p>
          <div className="form-actions">
            <div className="form-actions-main">
              <button
                type="button"
                onClick={handleDeleteCancel}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="delete-btn"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Use createPortal to render modal outside component tree
  return createPortal(
    showDeleteConfirmation ? confirmationDialog : modalContent,
    document.body
  );
};

export default Modal;
