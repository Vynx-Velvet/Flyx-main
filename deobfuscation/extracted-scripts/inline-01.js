
    
    /*
    $(document).ready(function(){
        
        
        if($.cookie('pop_asdf')){
            $("#pop_asdf").addClass("hidden");
        }
        
        $("#pop_asdf").click(function(){
            if(!$.cookie('pop_asdf')){
                if($.cookie('pop_asdf_tmp') >= 3){
                    var date = new Date();
                    date.setTime(date.getTime() + (10800 * 1000));
                    $.cookie('pop_asdf', 1, { expires: date });
                    $("#pop_asdf").addClass("hidden");
                }else{
                    var cookie_value = 1;
                    if($.cookie('pop_asdf_tmp'))
                        cookie_value = $.cookie('pop_asdf_tmp');
                        
                    cookie_value++;
                    
                    $.cookie('pop_asdf_tmp', cookie_value);
                    $(this).addClass("hidden");
                    setTimeout(function(){
                        $("#pop_asdf").removeClass("hidden");
                    }, 59000);
                }
            }
        });
    });
    */
    
        
    $("#pl_but_background , #pl_but").click(function(){
        loadIframe();
    });
    
        
    function loadIframe(data = 1){
        if(data == 1){
            $("#the_frame").removeAttr("style");
            $("#the_frame").html("");
            $('<iframe>', {
               id: 'player_iframe',
               src: '/prorcp/NzZkNTBjMWZkMDg3OWY2MTM0YmMyNGJiYTNlMjE4ZWY6U1d4VGNIQnRTREZaY0RSeFdtWk9NbEpoY1dScVUzZFNNRnBUUlRFMGFucFBZM1JLZDBOcU5rdEhkMDh4UjJZMmNUaDNha3RhYm0xNFpXUm1UMnhpU2xaQlZUZ3ZZMU01T1dObVpHNVZRV1J0UjBwS2NrMW9RbGxVTjNCbGQyczNLMjFzT0RkcmFFOXJObmMyZVVOdWFEZDRSSFZSUTFGVVFtd3ZiWEpIY210NFVsTlFiMVIxY21NM05uVjBTSEpXZGl0bVpWZzFSREJtTkhscmRsaHRaVUZzWldaWWMwdHJRemM0TTBnNVNtVnpTa3hZUmxvck9UZDNlR1Z1U205SWNUa3ZRMlZxZUVaU2RsSnpjVFpWVGtWUFdUUjFaM2hqYms1emQzZFRlRTVGZWxrMVVtWm5VekIzUm14NGRGbEJNM05CTkhsMldHczJjMlEzU0RFMkswUk1NVFE1ZUdKTWJEWkRkazU0Vnk5aWQxVnFSbnBNUTNJM2FFTnhaVFJCWldnd1ZubDBjazFSVVdKWU5sZE9abUZoZHk5MVRuTXJTM0ZuUjNORU4ybEVjbnBKWkZkS1VsVlBVMnh6TkV0dU9XSmxOa00wZVdGTFp6Y3ZWRlJ5ZDJOWlVXaEVSbEpJWW5odmVWZDFlRTA0Y0ZSaloySnFjSGR6VW1NemNURnFSVFkzVEVaU1dXWmxhbmt3UVVOR1l5OVJaekJaT0V4aVQzcFJVVmRCYXpsSFN5dEtOSGxDTmtWVkt6UkVhR2xSVFdrM1dIVk1jVXBUU2psakx6TjFZVTlUUlRSWmRrNHlXRUZ2V1Zjd1RFSkhZbGRGV0c1MFZWTXhURlpZVVRSWFZIRm5SRmRSV0N0QlRuRjFaall6TjB4U1JrSlVlbFZoUlhwU05sTkJTV05NYUdVM1pWRTRZV1Z3Tm5sSWIwRjFOVVI0VkRZd1ptZFZTME01V25oYUt5czRiVU5rTmtZNE1YQkpjbFEyY1Vodk5YTlNiMWt2TkVJMlMxSk9jSEUxWWpsYVRtYzNlRzR3YnpsdFpHWldXR2hFWkVOS0swMXdSVGt2WWxnMmFqYzJWWEJVU0N0RVV6VTFRazlUTDJGQmFXaDJPSE13ZG1WcU1tSlVibk55WW1GNFZtOW1NVWhYZVVRMGNtOVBNVlJ6UlVaeWRuaEdTbGRVZDA1V2VFOHZiWEF3WWxkTWRrOWxVVEJtV25CRlRXRXdhVEk0ZUZsQlNDdE1SakZUTkZKeVJESlZTRE0zT0M5UmRIUlpORmszY0RacWRtNUJXbWRYVEhKSlIyVm5PVkJoWmtVd1ptaDBiRlZxTkVac1MyMXJSbTlrTTNwWFVGVlhaVWh0Ulc4dkswMUNXV05QU2xrNVVubzNNRFZxZHpkck1uVkdiRmw2ZEZkMkwzSXhiVkJYUm1zdmRFNTJlVGRYT0hGeFl5dEdaMkZFYkVaVFVXUlBjWEZNTkN0SE9UVmpUUzkxZUhGRk9TOXNibUY2VFhWUkt6WXpiM1kxYVZsMVp6Z3ZiM1ZzYjNSTmFGWXdiVEJqTWtoT01YaDFhbEpGVUhkVmJGZFpNV1ZxY2pkdFRIWndOa051VDBkdGJ5ODNjWEp3WVdKNlkxcHFSMlZITVVOamJuUXJNa1JOV0hjeGJEaEtWR1J6YTIxMVkxZHdTM0ZpYW1sTWMwOHZPSEp1YkRKa1RISmhRbEJWVVc5aE0yTXhMMDlDVGxoaWVrZEVVM1V5UlVacU5sbGtNamszWTI5NldXWkVUbmwzT0hsbU5IZERLelZxZFRoVlNXSkRlV0l4TWpoeVVHcGxZa281V1UxaGRrdExZazR2TkZkcWFtWktSM0Y2UzBSQldGbEpSSFpIU0hscU0yWkpTekk0YW10c09VWlRiMFZLTjBKRU0wMUdNbXBFYUZsWFkxSndjamhYV0RkM01uQlROa0pMUml0SlRHSTRhMHBtVTBOcFpYUTNXblY2YkRaUlNUaHBTbkJtZDFaRVIwNVdjbmhETlVkWlFYZENVMXBTT0ZNelVVOHhTVkkxZERZM1RTdEZTRkJ3T1RJME5HWlJTRUZHZEd0aU4zUmlhRnAyWkhka1QwNUdLMFJqWVRSUGNtbERVbVp0VEhBNFZGZ3ZVU3R4TkRoS1NXOVhXaXRVUWpkbU1tcE1kQzh6VFROVGNXRnpOMlJ5Y0hOMlpsVjVTVFZ6Y1VKNGNYWm5aRzVpVGt4dlpFeFBOakFyTW5CV09GTk9Sa2RZUTBOelJtRjJiR1Z1ZUZSdWVtTjFSMVZ1V1RGT05XZGpPRzE2ZUVKbU1FODVSRlJXV205SlJVNVhlVkY0VW5WTUwwWlRNazlSTldVM1dGVndSbmxpV25oeWEwZ3pMM3AzUTFwaw--',
               frameborder: 0,
               scrolling: 'no',
               allowfullscreen: 'yes',
               allow: "autoplay",
               style: 'height: 100%; width: 100%;'
            }).appendTo('#the_frame');
            $("#player_iframe").on("load", function () {
                $("#the_frame").attr("style","background-image: none;");
            });
        }
    }
    
    // pm redirector
    window.addEventListener('message', message => {
        if (message.source == window) {
            return; // Skip message in this event listener
        }
        
        var the_iframe = document.getElementById('player_iframe');
        
        if(message.source == window.parent){
            the_iframe.contentWindow.postMessage(message.data,'*');
        }else{
            window.parent.postMessage(message.data , '*');
        }
        
        
        
    });
        
        
        
    