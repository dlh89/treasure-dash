
var globals = {
    modalElem: null,
    modals: {
        element: false,
        focusedElementBeforeOpened: false,
        firstFocusable: false,
        lastFocusable: false
    },
    isFlexSliderInitialised: false,
    content: null
};

jQuery(init);

function init() {
    globals.modalElem = jQuery('.js-modal');

    if (!globals.modalElem.length)
    {
        return;
    }

    setupEventListeners();
}

function setupEventListeners()
{
    globals.content = jQuery('.js-content');

    var openModalButtons = jQuery('.js-open-modal-btn');
    openModalButtons.on('click', openModal);

    var modalOverlay = jQuery('.js-modal-overlay');
    modalOverlay.on('click', closeModal);

    var closeBtn = jQuery('.js-close-modal-btn');
    closeBtn.on('click', closeModal);

    jQuery(document).on('keydown', modalKeyboardEvents);
}

function modalKeyboardEvents(e)
{
    if (!globals.modals.element)
    {
        return;
    }

    //esc
    if (e.keyCode && e.keyCode === 27)
    {
        closeModal();
    }

    //tab
    if (e.keyCode && e.keyCode === 9)
    {
        if (e.shiftKey)
        {
            if (globals.modals.firstFocusable && (e.target == globals.modals.firstFocusable))
            {
                e.preventDefault();
                globals.modals.lastFocusable.focus();
            }
        }
        else if (globals.modals.lastFocusable && (e.target == globals.modals.lastFocusable))
        {
            e.preventDefault();
            globals.modals.firstFocusable.focus();
        }
    }
}

function openModal(e, modalId = false)
{
    if (!modalId) {
        var modalBtn = jQuery(e.target).closest('.js-open-modal-btn');
        var modalId = modalBtn.attr('data-associated-modal-id');
    }

    globals.modals.focusedElementBeforeOpened = document.activeElement;
    var associatedModal = jQuery('[data-modal-id=' + modalId + ']');


    associatedModal.addClass('modal--active');
    globals.modals.element = associatedModal;

    var body = jQuery('body');
    body.addClass('body--modal-open');

    globals.modalElem.removeAttr('aria-hidden');
    globals.content.attr('aria-hidden', 'true');

    var focusable = jQuery(globals.modals.element).find('input, button, select, a, video');
    var lastFocusable = focusable.last()
    if (lastFocusable)
    {
        globals.modals.lastFocusable = lastFocusable[0];
    }
    var firstFocusable = focusable.first()
    if (firstFocusable)
    {
        globals.modals.firstFocusable = firstFocusable[0];
    }

    var modalContent = jQuery(globals.modals.element).find('.js-modal-content');
    modalContent.focus();

    maybeInitFlexslider(associatedModal);

    maybeFocusForm(associatedModal);
}

/**
 * If the associatedModal contains a flexslider then we need to initialise
 * it on first open
 *
 * @param {object} associatedModal jQuery object of the modal div
 */
function maybeInitFlexslider(associatedModal)
{
    if (associatedModal.find('.flexslider').length)
    {
        if (!globals.isFlexSliderInitialised)
        {
            globals.isFlexSliderInitialised = true;
            initFlexslider(); // flexslider can't be initialised while hidden
        }
    }
}

/**
 * If the modal has a form then focus the first input
 *
 * @param {object} associatedModal jQuery object of the modal div
 */
function maybeFocusForm(associatedModal)
{
    var form = associatedModal.find('form');
    if (form.length)
    {
        var inputs = form.find('input');
        jQuery(inputs.first()).trigger('focus');
    }
}

function closeModal()
{
    if (jQuery(globals.modals.element).hasClass('js-no-close')) {
        return;
    }
    var body = jQuery('body');
    body.removeClass('body--modal-open');

    jQuery(globals.modals.element).removeClass('modal--active');
    globals.modalElem.attr('aria-hidden', 'true');
    globals.content.removeAttr('aria-hidden');

    globals.modals.element = false;

    // return focus to where it was before we opened the dialog
    globals.modals.focusedElementBeforeOpened.focus();
}

function initFlexslider()
{
    // to prevent flashing while initialising, make it transparent until start callback
    jQuery('.js-rules-modal').css('opacity', '0');

    jQuery('.flexslider').flexslider({
        animation: "slide",
        slideshow: false,
        directionNav: false,
        start: function() {
            jQuery('.js-rules-modal').css('opacity', '1');
        }
    });

}

window.openModal = openModal;
window.closeModal = closeModal;