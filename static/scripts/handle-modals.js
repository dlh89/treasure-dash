/**
 * Each modal open and close button should have a data-modal-class attribute
 * Multiple modals can be opened at once
 */

globals = {
  modalOverlay: jQuery('.modal__overlay'),
  escKeyCode: 27,
  openModals: []
}

// set up listeners
jQuery('.js-open-modal-btn').on('click', function() {
  var modalElem = jQuery(this).attr('data-modal-class');
  openModal(modalElem);
});
jQuery('.js-close-modal-btn').on('click', function() { 
  var modalElem = jQuery(this).attr('data-modal-class');
  closeModal(modalElem);
});
jQuery(document).on('keyup', handleKeyUp);
jQuery('.js-modal-overlay').on('click', handleOverlayClick);

function handleKeyUp(e)
{
  if (globals.openModals.length && (e.keyCode == globals.escKeyCode)) {
    // close the last modal that was opened
    closeModal(globals.openModals[globals.openModals.length - 1]);
  }
}

function handleOverlayClick() {
  if (globals.openModals.length) {
    // close the last modal that was opened
    closeModal(globals.openModals[globals.openModals.length - 1]);
  }
}

function openModal(modalElem) {
  // check modal isn't already open
  if (globals.openModals.indexOf(modalElem) == -1)
  {
    jQuery(modalElem).show();
    globals.modalOverlay.show();
    globals.openModals.push(modalElem);
  }
}

function closeModal(modalElem) {
  jQuery(modalElem).hide();
  globals.openModals.splice(globals.openModals.indexOf(modalElem), 1);
  if (!globals.openModals.length) {
    globals.modalOverlay.hide();
  }
}