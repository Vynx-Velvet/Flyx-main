function cpFunction() {
  var copyText = document.getElementById("cptxt");
  copyText.select(); copyText.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(copyText.value);
  alert("Copied the text: " + copyText.value);
}
$(".playbtnx").click(function(){
  var iframe = $("#iframesrc");
  iframe.attr("src", iframe.data("src"));
  $(".dropdown").show();
});
function bgImage() {
  var x = document.getElementById("bgImage");
  if (x.style.display === "none") { x.style.display = "block"; }
  else { document.getElementById("bgImage").remove(); $(".playbtnx").hide(); }
}
function myFunction() {
  document.getElementById("myDropdown").classList.toggle("show");
}
window.onclick = function(event) {
  if (!event.target.matches('.dropbtn')) {
    var dropdowns = document.getElementsByClassName("dropdown-content");
    for (var i=0;i<dropdowns.length;i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.classList.contains('show')) openDropdown.classList.remove('show');
    }
  }
}