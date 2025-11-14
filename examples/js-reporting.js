function gen_reporting_el(){
    $("#player_parent #oframeplayer_parent").append("<div class='reporting_window'></div>");
    $(".reporting_window").append($("#reporting_content").html());
}

function showReportWindow(){
    if ($(".reporting_window").is(":visible")) {
        $(".reporting_window").hide();
    }else{
        $(".reporting_window").show();
    }
}

$(document).ready(function(){
    $(".reporting_window #sentReport").click(function(){
        var postdata = {
            hash: $(this).data("hash"),
            problem: $('.reporting_window input[name="problem"]:checked').val() ,
            math: $(".reporting_window #math").val() ,
            solution: $(".reporting_window #solution").val()
        }
        $.post("/reporting.php", postdata ,function(data){
            
        }).always(function(data) {
            if(data == "1"){
                $(".reporting_window .content").html(`
                <div>
                    <p>Report already sent!</p>
                </div>
                `);
                $(".reporting_window").hide();
                alert("Thanks for reporting.");
            }else{
                alert("Try again.");
            }
        });
    });
    
    
    $(".reporting_window .header #close").click(function(){
        $(".reporting_window").hide();
    });
    
});

window.addEventListener('click', function(e){  
    var is_reporting_window  = false;

    $('.reporting_window').each(function(i, obj) {
        if(obj.contains(e.target)){
            is_reporting_window = true;
        }
    });
    
    if(e.target.getAttribute("class") != "lang"){
        if (
            !$("#player_parent_control_reportingButton")[0].contains(e.target) &&
            !$(".reporting_window")[0].contains(e.target)
        ){
            $(".reporting_window").hide();
        }
    }
});