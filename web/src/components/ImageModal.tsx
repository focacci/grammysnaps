import React from "react";
import "./ImageModal.css";

export type ImageModalMode = "create" | "preview" | "edit";

interface ImageModalProps {
  isOpen: boolean;
  mode: ImageModalMode;
  title: string;
  onClose: () => void;
  onLeftAction: () => void;
  onRightAction: ((e: React.FormEvent) => void | Promise<void>) | (() => void);
  leftButtonText: string;
  rightButtonText: string;
  leftButtonDisabled?: boolean;
  rightButtonDisabled?: boolean;
  leftButtonClass?: string;
  rightButtonClass?: string;
  children: React.ReactNode;
  imageSection: React.ReactNode;
  showSelectDifferentButton?: boolean;
  onSelectDifferentPhoto?: () => void;
  onBack?: () => void; // Optional back button callback
}

const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  mode,
  title,
  onClose,
  onLeftAction,
  onRightAction,
  leftButtonText,
  rightButtonText,
  leftButtonDisabled = false,
  rightButtonDisabled = false,
  leftButtonClass = "cancel-btn",
  rightButtonClass = "submit-btn",
  children,
  imageSection,
  showSelectDifferentButton = false,
  onSelectDifferentPhoto,
  onBack,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (onRightAction as (e: React.FormEvent) => void | Promise<void>)(e);
  };

  const handleButtonClick = () => {
    (onRightAction as () => void)();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className={`modal-content ${
          mode === "preview" ? "image-modal-preview" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-left">
            {mode === "edit" && onBack && (
              <button
                className="back-btn"
                onClick={onBack}
                title="Back to preview"
              >
                ←
              </button>
            )}
            <h2>{title}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {mode === "create" || mode === "edit" ? (
            <form onSubmit={handleFormSubmit} className="upload-form">
              <div className="form-content">
                <div className="form-group">
                  {imageSection}
                  {showSelectDifferentButton && onSelectDifferentPhoto && (
                    <button
                      type="button"
                      className="change-file-btn"
                      onClick={onSelectDifferentPhoto}
                    >
                      Select Different Photo
                    </button>
                  )}
                </div>
                {children}
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={onLeftAction}
                  disabled={leftButtonDisabled}
                  className={leftButtonClass}
                >
                  {leftButtonText}
                </button>
                <button
                  type="submit"
                  disabled={rightButtonDisabled}
                  className={rightButtonClass}
                >
                  {rightButtonText}
                </button>
              </div>
            </form>
          ) : (
            // Preview mode
            <div className="image-preview-content">
              {imageSection}
              {children}
              <div className="form-actions">
                <button
                  type="button"
                  onClick={onLeftAction}
                  disabled={leftButtonDisabled}
                  className={leftButtonClass}
                >
                  {leftButtonText}
                </button>
                <button
                  type="button"
                  onClick={handleButtonClick}
                  disabled={rightButtonDisabled}
                  className={rightButtonClass}
                >
                  {rightButtonText}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
