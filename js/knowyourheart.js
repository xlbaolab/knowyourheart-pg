$(function() {

  /* Clear placeholder text upon focus */
  $('input').data('holder', $('input').attr('placeholder'));
  $('input').focusin(function() {
    $(this).attr('placeholder', '');
  });
  $('input').focusout(function() {
    $(this).attr('placeholder', $(this).data('holder'));
  });

  /* Tooltip */
  $(document).ready(function() {
    $('.tooltip').jqmTooltip();
  });

});
