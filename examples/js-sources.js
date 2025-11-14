$(document).ready(function() {
    $(".button_content #content").on('click', '.close', function(){
        $(this).parent().parent().fadeOut("fast");
    });
    $("#sources #list .source").click(function() {
        $("#the_frame").removeAttr("style");
        
        if ($(this).find("#name").html() != "VidSrc PRO") {
            $("#top_buttons #cc").addClass("button_inactive");
        } else {
            $("#top_buttons #cc").removeClass("button_inactive");
        }
        
        $("#the_frame").html("");
        $('<iframe>', {
            src: "//cloudnestra.com/rcp/" + $(this).data("hash"),
            frameborder: 0,
            scrolling: 'no',
            allowfullscreen: 'yes',
            height: '100%',
            width: '100%'
        }).appendTo('#the_frame');
        $("#sources #list .active_source").removeClass("active_source");
        $(this).addClass("active_source");
        $("#sources").hide();
        $("#player_iframe").on("load", function () {
            $("#the_frame").attr("style","background-image: none;");
        });
    });
    
    $(".servers .serversList .server").click(function() {
        $("#the_frame").html("");
        $('<iframe>', {
            src: "//cloudnestra.com/rcp/" + $(this).data("hash"),
            frameborder: 0,
            scrolling: 'no',
            allowfullscreen: 'yes',
            height: '100%',
            width: '100%'
        }).appendTo('#the_frame');
        $(".servers .serversList").hide();
        $("#player_iframe").on("load", function () {
            $("#the_frame").attr("style","background-image: none;");
        });
    });
    
    $(".servers .serversToggle").click(function() {
        $(".servers .serversList").toggle();
    });
    
    $("#top_buttons #source").click(function() {
        $("#sources").fadeIn("fast");
    });
    $("#top_buttons #cc").click(function() {
        $("#subtitles").fadeIn("fast");
    });
});
$(document).mouseup(function(e) {
    if ($('.button_content #content').is(':visible')) {
        var container = $(".button_content #content");
        if (!container.is(e.target) && container.has(e.target).length === 0) {
            $(".button_content").fadeOut("fast");
        }
    }
});