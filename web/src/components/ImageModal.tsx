import React from "react";
import Modal from "./Modal";

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
  const modalMode = mode === "preview" ? "preview" : "form";

  const headerSection = (
    <>
      {imageSection}
      {showSelectDifferentButton && onSelectDifferentPhoto && (
        <button
          type="button"
          className="additional-btn"
          onClick={onSelectDifferentPhoto}
        >
          Select Different Photo
        </button>
      )}
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      mode={modalMode}
      title={title}
      onClose={onClose}
      onLeftAction={onLeftAction}
      onRightAction={onRightAction}
      leftButtonText={leftButtonText}
      rightButtonText={rightButtonText}
      leftButtonDisabled={leftButtonDisabled}
      rightButtonDisabled={rightButtonDisabled}
      leftButtonClass={leftButtonClass}
      rightButtonClass={rightButtonClass}
      headerSection={headerSection}
      onBack={onBack}
      maxWidth="600px"
      showAdditionalButton={showSelectDifferentButton}
      onAdditionalAction={onSelectDifferentPhoto}
      additionalButtonText="Select Different Photo"
      additionalButtonClass="additional-btn"
    >
      {children}
    </Modal>
  );
};

export default ImageModal;
