globals = {
  modalOpen: false,
  rulesModal: jQuery('.js-rules-modal'),
  modalOverlay: jQuery('.modal__overlay'),
  escKeyCode: 27
}

// TODO pass modal name to open/close functions
// TODO include other modals

// set up listeners
jQuery('.js-rules-btn').on('click', openRules);
jQuery('.js-close-rules-btn').on('click', closeRules);
jQuery(document).on('keyup', handleKeyUp);
jQuery('.js-modal-overlay').on('click', handleOverlayClick);

function handleKeyUp(e)
{
  if (globals.modalOpen && (e.keyCode == globals.escKeyCode)) {
    closeRules();
  }
}

function handleOverlayClick() {
  if (globals.modalOpen) {
    closeRules();
  }
}

function openRules() {
  globals.modalOpen = true;
  globals.modalOverlay.show();
  globals.rulesModal.show();
}

function closeRules() {
  globals.modalOpen = false;
  globals.rulesModal.hide();
  globals.modalOverlay.hide();
}

// TODO handle esc/click outside modal to close