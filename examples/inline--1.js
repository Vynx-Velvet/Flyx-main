var ds_langs = [];
        var ds_lang = false;
        var sub_shown_lang = "";
        
        
        
        
        var flnm = removeExtension(atob('RmlnaHQgQ2x1YiAoMTk5OSkgWzEwODBwXS9GaWdodC5DbHViLjEwdGguQW5uaXZlcnNhcnkuRWRpdGlvbi4xOTk5LjEwODBwLkJyUmlwLngyNjQuWUlGWS5tcDQ='));
        
        
        flnm = flnm.split("/");
        var flnm_data = [];
        for (const key in flnm) {
            flnm_data.push(tprs.parse(flnm[key]));
        }
        
        var pljs_sub_lang = localStorage.getItem("pljssubtitle");
        if(typeof pljs_sub_lang === 'string' || pljs_sub_lang instanceof String){
            for (let lang of sub_langs) {
                var tmp_lang_regexp = new RegExp(lang.LanguageName, "i");
                if(tmp_lang_regexp.test(pljs_sub_lang)){
                    ds_lang = lang;
                    break;
                }
            }
        }
    
    
        
    
                ds_lang = get_lang_from_iso639(JSON.parse('[]')[0]);
                
                
        
        var pass_path = "//tmstr5.cloudnestra.com/rt_ping.php";
        
        var ping_interval = false;
        
        
        var subs_shown = false;
        var the_subtitles = [];
        
        var default_subtitles = "";
          
                    default_subtitles = "[]";
                    
        
        
        
                var db_subs = [];
                
        
        var lc_on = IsLcOn();
        
        var current_sub_name = "cs_"+$("body").data("i");
        
        if($("body").data("s") && $("body").data("e")){
            current_sub_name += "_"+$("body").data("s")+"x"+$("body").data("e");
        }
        
        if(default_subtitles.length > 0){
            the_subtitles = default_subtitles.split(",");
            //player.api("subtitle",default_subtitles);
        }
        
        
        //var player = new Playerjs({id:"player_parent", cuid:"50627283dc40ce660f24a5e1454d9327",file:"", poster:"//image.tmdb.org/t/p/w780/5TiwfWEaPSwD20uwXjCTUqpQX70.jpg" , ready:"PlayerReady" , autoplay:1 , subtitle: default_subtitles});
                
                var player = new Playerjs({id:"player_parent", file: IhWrImMIGL , cuid:"50627283dc40ce660f24a5e1454d9327",poster:"//image.tmdb.org/t/p/w780/5TiwfWEaPSwD20uwXjCTUqpQX70.jpg" , ready:"PlayerReady" , autoplay:1 , subtitle: default_subtitles , "default_quality":"max"});    
                
        
        if(player.api("subtitles").length > 1 && ds_lang){
            setStartSubtitle();
        }else if(player.api("subtitles").length === 1){
            player.api("subtitle" , player.api("subtitles").length-1);
        }
        
                
        
        
        if(lc_on){
            current_sub = localStorage.getItem(current_sub_name);
            if(typeof current_sub === 'string' && isJson(current_sub)){
                current_sub = JSON.parse(current_sub);
                if(current_sub.lang_short != sub_shown_lang){
                    addSubtitle(current_sub);
                }
            }
        }
        
        var video = $("#player_parent").find("video")[0];
    
    
        
                var watched = {
            value: 0,
            report: 0,
            interval: false ,
            duration: 0,
            set: function (value) {
                this.value = value;
                this.onChange();
            },
            onChange: function(){
                //console.log(this.value);
                //console.log(this.duration);
                if(this.duration > 0){
                    if(this.report < 5){
                        var limit = this.duration*0.05;
                        if(limit < 30){
                            limit = 30
                        }
                        if(this.value > limit){
                            this.report = 5;
                            $.get("/fsdD/ZjZmN2U4ZmIwMWNhYTk5NTM3NDM1ZmNmYjc4ZDI4OGM6Y1dGNFJqTm5TakppV1hGNFJFMWlVR1pQZVVVMFlVVk9ZV001Tmtrd05VbEliSGhaVWxWMFYydFdabXBwZUU5VmFDdGpkbWRTTkcxTU9FNWhTMHBuY214SWNYSndTSHBoV25WNmJqWk1SR0o1ZDAwMmJHd3ZZbVZZUnpGa2VGcEVjeXRvVW5obVZHbE5aazlWZEVjMldVUm1iWEJSY2xsTU0xUlJZbVZKUzNoeWVFeFVSMFZ5UlM5dVQyeDNTVXBZWTBwNWQyUjJkMmhUWVhRMlVVODVPRE0zUlVGSE9HVTNNVkJoVUdWalNtdGtiSFZDTDIxeGVFMUtPRk5KVVdRMVFtRkZlbmczYnpaMWNXUlNSRzFJU0dwSGVqbExTbXhITWpCcU5VeFZWR1JTWjFFNWRIYzJUalpYUWtsTWVESmFla0kzWW5FeFN6Uk1OREY1WlhkRkszaEJSMUkzVW1sWVJUZzRVVU52VkhkMFJFZHhTSEUyTkZSUVJXNHhaM1ZvWVUxa1NqWmFNMW8yT1hSak1uSm1Na2RtYTFSRE0xVTRaV3BpVW5acmJrbGtUMkZVYm5SRVFtRk9SVVp3UlRobk9Xc3JRVm8wV2poRVJsQkdZbTFNVFZWTGJ6RTRTMmxCTlhKV1UwWnNObXhZVm5OdFdXOXNhMXB4YVdReFNuRlNhbkZvTVdGaVEwNVBWR1JWYTFNMEwyUTFaM1JTUTI5WFZIUXpjRWRaYjBRNU1XbFlWakkzZGpCd1NIUTFabVpSUzFSWWMzUk1hMWh3VVZSU1VEZG1aazU0YlRZMlJXUm9NVk15ZFdVNEwwaHJVbTlsUnpaSGVVZEhUVkZhYTNocFRWTnFRMWxzZFVWT1QwRm5XV0UzYWpnNFdWaDJWMnRIY0d4UmEwOVJObkZNT0dNcmIzbEZWekZ6YjBaaVR6SjFRMWhVVnpGd2MzRnlXbEJPV25oNFZYbGtla3hTV0cxdU56TlJOM2RHVTFBNVJsbFVOVVYyZDNGb1FtaEpibXh0V0V0VWVsWlNNSFF2TkVac2FHUmFlakZoTm1kUVdqVlBTMjlVTkZWalRGUjJaMVYxTkhCM1JWaFFaRFV3YlN0QllYVTRNVVJNVGs1dVkzQlVhVmh3ZFVSamVrOHdiM1ZrU0VkSWN6ZzRkVWt6TlUxNmVrSnNUbGt6UlZWRk5ETTJMM05MWTBrMk9UTlNSRWRrSzBFeVVXMXJXRFZxTXpKR1lrTTVSMmxWZUhjM2MxZG1VamRrZW1sdVZscEdPV0ZqVEZRelRGWXliMk15VEhkYVltWktTRXBpSzJoTWJ6QXpObFYyVVhwbVdtSnhjbE5DYUZsSVp6ZEJhVXRJV0RadGJWbGplRGx4U1V3M2RISm5SMkZPYWxaQ2FYSndiMUpzYVVWRWEza3dlRGt3THpWSVVYTmxWVnB1YzIxMmVVTlZiMU5xYTFOdk1HcElSbEpYZUZGaVpuTmtTRVZxTUVVeVJWSm5lRWN3UzBaVVJUWk9LM2RFVEhscGNDOUdiV0ZzZUVsWWEzVlJTR2QzY1djdlUyRmpjeTlLWVZJeU5tVnNXaTk1UkZkWVdUQnRVbTA0ZDIxaWMyVXlSMFZCWldWYVJWSnhlVVUwVTFWT1VHaGtkblZYUzJkSU1HVlVWa1pPT1dScFdIaDFlSHBUYkU5SlRGUlhlREJTZW01Wllub3JhVWt3VFZSa1ZFZFBaRVpCZEVVNFRsbGliblJZVkRGSmFFNUhMMEYwUmtGeE5EWk1USEEzWTFJMlEycGpNMG93TlcxU1Iza3dlUzkxTnpreGIzVjRPRnBsT1ZabE9HSnFWVWwxY2tFemNFVkVhRTFKTkhSS1pWUlJOVlZYV1ZVMlNWZHNXRmxTTlhCV1oxQkVRaXRpWTI5RVJtSmpRMHhTTjI1UFZsVXJRV1pxUzFZNFEwbGxTbEl3Ym5sQmN5dEtSREZTZG1acE1VWTVUMlZGWjJaS09URjBOVXBtWVV4WlMyOWhaazFEYW00MmREZGhVWEpMU0RaSVpFOXZOMFZCZGxCak5uRTJRblIyUW5wTFRHbENaRTlhVjB4MFNEZEhPWHB1VDFoSlZFZ3dORFJIZWlzdmFUZEJXV3ByWnl0SVFXWnlkamxwTUdwemVYcGlaWEpRU1E9PQ--");
                        }
                        /*
                        if(this.value > (this.duration*0.05)){
                            this.report = 5;
                            $.get("/vsdV/ZjZmN2U4ZmIwMWNhYTk5NTM3NDM1ZmNmYjc4ZDI4OGM6Y1dGNFJqTm5TakppV1hGNFJFMWlVR1pQZVVVMFlVVk9ZV001Tmtrd05VbEliSGhaVWxWMFYydFdabXBwZUU5VmFDdGpkbWRTTkcxTU9FNWhTMHBuY214SWNYSndTSHBoV25WNmJqWk1SR0o1ZDAwMmJHd3ZZbVZZUnpGa2VGcEVjeXRvVW5obVZHbE5aazlWZEVjMldVUm1iWEJSY2xsTU0xUlJZbVZKUzNoeWVFeFVSMFZ5UlM5dVQyeDNTVXBZWTBwNWQyUjJkMmhUWVhRMlVVODVPRE0zUlVGSE9HVTNNVkJoVUdWalNtdGtiSFZDTDIxeGVFMUtPRk5KVVdRMVFtRkZlbmczYnpaMWNXUlNSRzFJU0dwSGVqbExTbXhITWpCcU5VeFZWR1JTWjFFNWRIYzJUalpYUWtsTWVESmFla0kzWW5FeFN6Uk1OREY1WlhkRkszaEJSMUkzVW1sWVJUZzRVVU52VkhkMFJFZHhTSEUyTkZSUVJXNHhaM1ZvWVUxa1NqWmFNMW8yT1hSak1uSm1Na2RtYTFSRE0xVTRaV3BpVW5acmJrbGtUMkZVYm5SRVFtRk9SVVp3UlRobk9Xc3JRVm8wV2poRVJsQkdZbTFNVFZWTGJ6RTRTMmxCTlhKV1UwWnNObXhZVm5OdFdXOXNhMXB4YVdReFNuRlNhbkZvTVdGaVEwNVBWR1JWYTFNMEwyUTFaM1JTUTI5WFZIUXpjRWRaYjBRNU1XbFlWakkzZGpCd1NIUTFabVpSUzFSWWMzUk1hMWh3VVZSU1VEZG1aazU0YlRZMlJXUm9NVk15ZFdVNEwwaHJVbTlsUnpaSGVVZEhUVkZhYTNocFRWTnFRMWxzZFVWT1QwRm5XV0UzYWpnNFdWaDJWMnRIY0d4UmEwOVJObkZNT0dNcmIzbEZWekZ6YjBaaVR6SjFRMWhVVnpGd2MzRnlXbEJPV25oNFZYbGtla3hTV0cxdU56TlJOM2RHVTFBNVJsbFVOVVYyZDNGb1FtaEpibXh0V0V0VWVsWlNNSFF2TkVac2FHUmFlakZoTm1kUVdqVlBTMjlVTkZWalRGUjJaMVYxTkhCM1JWaFFaRFV3YlN0QllYVTRNVVJNVGs1dVkzQlVhVmh3ZFVSamVrOHdiM1ZrU0VkSWN6ZzRkVWt6TlUxNmVrSnNUbGt6UlZWRk5ETTJMM05MWTBrMk9UTlNSRWRrSzBFeVVXMXJXRFZxTXpKR1lrTTVSMmxWZUhjM2MxZG1VamRrZW1sdVZscEdPV0ZqVEZRelRGWXliMk15VEhkYVltWktTRXBpSzJoTWJ6QXpObFYyVVhwbVdtSnhjbE5DYUZsSVp6ZEJhVXRJV0RadGJWbGplRGx4U1V3M2RISm5SMkZPYWxaQ2FYSndiMUpzYVVWRWEza3dlRGt3THpWSVVYTmxWVnB1YzIxMmVVTlZiMU5xYTFOdk1HcElSbEpYZUZGaVpuTmtTRVZxTUVVeVJWSm5lRWN3UzBaVVJUWk9LM2RFVEhscGNDOUdiV0ZzZUVsWWEzVlJTR2QzY1djdlUyRmpjeTlLWVZJeU5tVnNXaTk1UkZkWVdUQnRVbTA0ZDIxaWMyVXlSMFZCWldWYVJWSnhlVVUwVTFWT1VHaGtkblZYUzJkSU1HVlVWa1pPT1dScFdIaDFlSHBUYkU5SlRGUlhlREJTZW01Wllub3JhVWt3VFZSa1ZFZFBaRVpCZEVVNFRsbGliblJZVkRGSmFFNUhMMEYwUmtGeE5EWk1USEEzWTFJMlEycGpNMG93TlcxU1Iza3dlUzkxTnpreGIzVjRPRnBsT1ZabE9HSnFWVWwxY2tFemNFVkVhRTFKTkhSS1pWUlJOVlZYV1ZVMlNWZHNXRmxTTlhCV1oxQkVRaXRpWTI5RVJtSmpRMHhTTjI1UFZsVXJRV1pxUzFZNFEwbGxTbEl3Ym5sQmN5dEtSREZTZG1acE1VWTVUMlZGWjJaS09URjBOVXBtWVV4WlMyOWhaazFEYW00MmREZGhVWEpMU0RaSVpFOXZOMFZCZGxCak5uRTJRblIyUW5wTFRHbENaRTlhVjB4MFNEZEhPWHB1VDFoSlZFZ3dORFJIZWlzdmFUZEJXV3ByWnl0SVFXWnlkamxwTUdwemVYcGlaWEpRU1E9PQ--");
                        }
                        */
                    }
                    
                }
            },
            setDur: function(dur){
                this.duration = dur;
            }
        }
                
        function PlayerReady(){
            gen_subs_el();
            gen_reporting_el();
        }
    
    
            
        var pm_player_data = {type:"PLAYER_EVENT"};
        var pm_time_last_update = 0;
        var pm_time_last_update_use = false;
        
        pm_player_data.data = {
            imdbId: "tt0137523",
            tmdbId: 550,
            type: "movie",
            season: false,
            episode: false,
            currentTime: 0,
            duration: 0
        };
    
        function PlayerjsEvents(event,id,data){
            
            
            if(event=="play"){
                if(!ping_interval)
                    restart_ping_interval();
                
                pm_player_data.data.event = "play";
                window.parent.postMessage(pm_player_data , '*');
                //console.log(pm_player_data);
                
                if(!watched.interval){
                    watched.interval = setInterval(function(){
                        if(player.api("playing")){
                            watched.set(watched.value+1);
                            if(watched.value % 60 == 0){
                                //$.get("/watched");
                            }
                        }
                    },1000);
                }
            }
            
            if(event == "pause"){
                clearInterval(ping_interval);
                ping_interval = false;
                pm_player_data.data.event = "pause";
                window.parent.postMessage(pm_player_data , '*');
                //console.log(pm_player_data);
            }
            
            if(event == "time"){
                if((Date.now() - pm_time_last_update) > 5000){
                    pm_time_last_update = Date.now();
                    pm_player_data.data.event = "timeupdate";
                    pm_player_data.data.currentTime = parseInt(player.api("time"));
                    window.parent.postMessage(pm_player_data , '*');
                }
            }
            
            if(event == "end"){
                clearInterval(ping_interval);
                ping_interval = false;
                pm_player_data.data.event = "ended";
                pm_player_data.data.currentTime = parseInt(player.api("duration"));
                window.parent.postMessage(pm_player_data , '*');
                player.api("pause");
                //console.log(pm_player_data);
                
                            }
            
            if(event == "seek"){
                pm_player_data.data.event = "seeked";
                pm_player_data.data.currentTime = parseInt(player.api("time"));
                window.parent.postMessage(pm_player_data , '*');
                //console.log(pm_player_data);
            }
            
            
            if(event=="networkErrorHls"){
                data_parsed = JSON.parse(data);
                if(data_parsed.details == "fragLoadError" && data_parsed.fatal && watched.value < 60){
                    // checkAndLogUrlStatus();
                    // logToServerAndRedirect(pm_player_data);
                    // window.location.replace("https://cloudnestra.comZjZmN2U4ZmIwMWNhYTk5NTM3NDM1ZmNmYjc4ZDI4OGM6Y1dGNFJqTm5TakppV1hGNFJFMWlVR1pQZVVVMFlVVk9ZV001Tmtrd05VbEliSGhaVWxWMFYydFdabXBwZUU5VmFDdGpkbWRTTkcxTU9FNWhTMHBuY214SWNYSndTSHBoV25WNmJqWk1SR0o1ZDAwMmJHd3ZZbVZZUnpGa2VGcEVjeXRvVW5obVZHbE5aazlWZEVjMldVUm1iWEJSY2xsTU0xUlJZbVZKUzNoeWVFeFVSMFZ5UlM5dVQyeDNTVXBZWTBwNWQyUjJkMmhUWVhRMlVVODVPRE0zUlVGSE9HVTNNVkJoVUdWalNtdGtiSFZDTDIxeGVFMUtPRk5KVVdRMVFtRkZlbmczYnpaMWNXUlNSRzFJU0dwSGVqbExTbXhITWpCcU5VeFZWR1JTWjFFNWRIYzJUalpYUWtsTWVESmFla0kzWW5FeFN6Uk1OREY1WlhkRkszaEJSMUkzVW1sWVJUZzRVVU52VkhkMFJFZHhTSEUyTkZSUVJXNHhaM1ZvWVUxa1NqWmFNMW8yT1hSak1uSm1Na2RtYTFSRE0xVTRaV3BpVW5acmJrbGtUMkZVYm5SRVFtRk9SVVp3UlRobk9Xc3JRVm8wV2poRVJsQkdZbTFNVFZWTGJ6RTRTMmxCTlhKV1UwWnNObXhZVm5OdFdXOXNhMXB4YVdReFNuRlNhbkZvTVdGaVEwNVBWR1JWYTFNMEwyUTFaM1JTUTI5WFZIUXpjRWRaYjBRNU1XbFlWakkzZGpCd1NIUTFabVpSUzFSWWMzUk1hMWh3VVZSU1VEZG1aazU0YlRZMlJXUm9NVk15ZFdVNEwwaHJVbTlsUnpaSGVVZEhUVkZhYTNocFRWTnFRMWxzZFVWT1QwRm5XV0UzYWpnNFdWaDJWMnRIY0d4UmEwOVJObkZNT0dNcmIzbEZWekZ6YjBaaVR6SjFRMWhVVnpGd2MzRnlXbEJPV25oNFZYbGtla3hTV0cxdU56TlJOM2RHVTFBNVJsbFVOVVYyZDNGb1FtaEpibXh0V0V0VWVsWlNNSFF2TkVac2FHUmFlakZoTm1kUVdqVlBTMjlVTkZWalRGUjJaMVYxTkhCM1JWaFFaRFV3YlN0QllYVTRNVVJNVGs1dVkzQlVhVmh3ZFVSamVrOHdiM1ZrU0VkSWN6ZzRkVWt6TlUxNmVrSnNUbGt6UlZWRk5ETTJMM05MWTBrMk9UTlNSRWRrSzBFeVVXMXJXRFZxTXpKR1lrTTVSMmxWZUhjM2MxZG1VamRrZW1sdVZscEdPV0ZqVEZRelRGWXliMk15VEhkYVltWktTRXBpSzJoTWJ6QXpObFYyVVhwbVdtSnhjbE5DYUZsSVp6ZEJhVXRJV0RadGJWbGplRGx4U1V3M2RISm5SMkZPYWxaQ2FYSndiMUpzYVVWRWEza3dlRGt3THpWSVVYTmxWVnB1YzIxMmVVTlZiMU5xYTFOdk1HcElSbEpYZUZGaVpuTmtTRVZxTUVVeVJWSm5lRWN3UzBaVVJUWk9LM2RFVEhscGNDOUdiV0ZzZUVsWWEzVlJTR2QzY1djdlUyRmpjeTlLWVZJeU5tVnNXaTk1UkZkWVdUQnRVbTA0ZDIxaWMyVXlSMFZCWldWYVJWSnhlVVUwVTFWT1VHaGtkblZYUzJkSU1HVlVWa1pPT1dScFdIaDFlSHBUYkU5SlRGUlhlREJTZW01Wllub3JhVWt3VFZSa1ZFZFBaRVpCZEVVNFRsbGliblJZVkRGSmFFNUhMMEYwUmtGeE5EWk1USEEzWTFJMlEycGpNMG93TlcxU1Iza3dlUzkxTnpreGIzVjRPRnBsT1ZabE9HSnFWVWwxY2tFemNFVkVhRTFKTkhSS1pWUlJOVlZYV1ZVMlNWZHNXRmxTTlhCV1oxQkVRaXRpWTI5RVJtSmpRMHhTTjI1UFZsVXJRV1pxUzFZNFEwbGxTbEl3Ym5sQmN5dEtSREZTZG1acE1VWTVUMlZGWjJaS09URjBOVXBtWVV4WlMyOWhaazFEYW00MmREZGhVWEpMU0RaSVpFOXZOMFZCZGxCak5uRTJRblIyUW5wTFRHbENaRTlhVjB4MFNEZEhPWHB1VDFoSlZFZ3dORFJIZWlzdmFUZEJXV3ByWnl0SVFXWnlkamxwTUdwemVYcGlaWEpRU1E9PQ--");
                }
            }
            
            //if(event=="loaderror"){
                
                
                if(data == "manifestLoadError (networkError)" || data == "not found" || data == "Media failed to decode"){
                    //reloadWithPost({ fallback_url_path: ''});
                    // checkAndLogUrlStatus();
                    // logToServerAndRedirect(pm_player_data);
                    // window.location.replace("https://cloudnestra.comZjZmN2U4ZmIwMWNhYTk5NTM3NDM1ZmNmYjc4ZDI4OGM6Y1dGNFJqTm5TakppV1hGNFJFMWlVR1pQZVVVMFlVVk9ZV001Tmtrd05VbEliSGhaVWxWMFYydFdabXBwZUU5VmFDdGpkbWRTTkcxTU9FNWhTMHBuY214SWNYSndTSHBoV25WNmJqWk1SR0o1ZDAwMmJHd3ZZbVZZUnpGa2VGcEVjeXRvVW5obVZHbE5aazlWZEVjMldVUm1iWEJSY2xsTU0xUlJZbVZKUzNoeWVFeFVSMFZ5UlM5dVQyeDNTVXBZWTBwNWQyUjJkMmhUWVhRMlVVODVPRE0zUlVGSE9HVTNNVkJoVUdWalNtdGtiSFZDTDIxeGVFMUtPRk5KVVdRMVFtRkZlbmczYnpaMWNXUlNSRzFJU0dwSGVqbExTbXhITWpCcU5VeFZWR1JTWjFFNWRIYzJUalpYUWtsTWVESmFla0kzWW5FeFN6Uk1OREY1WlhkRkszaEJSMUkzVW1sWVJUZzRVVU52VkhkMFJFZHhTSEUyTkZSUVJXNHhaM1ZvWVUxa1NqWmFNMW8yT1hSak1uSm1Na2RtYTFSRE0xVTRaV3BpVW5acmJrbGtUMkZVYm5SRVFtRk9SVVp3UlRobk9Xc3JRVm8wV2poRVJsQkdZbTFNVFZWTGJ6RTRTMmxCTlhKV1UwWnNObXhZVm5OdFdXOXNhMXB4YVdReFNuRlNhbkZvTVdGaVEwNVBWR1JWYTFNMEwyUTFaM1JTUTI5WFZIUXpjRWRaYjBRNU1XbFlWakkzZGpCd1NIUTFabVpSUzFSWWMzUk1hMWh3VVZSU1VEZG1aazU0YlRZMlJXUm9NVk15ZFdVNEwwaHJVbTlsUnpaSGVVZEhUVkZhYTNocFRWTnFRMWxzZFVWT1QwRm5XV0UzYWpnNFdWaDJWMnRIY0d4UmEwOVJObkZNT0dNcmIzbEZWekZ6YjBaaVR6SjFRMWhVVnpGd2MzRnlXbEJPV25oNFZYbGtla3hTV0cxdU56TlJOM2RHVTFBNVJsbFVOVVYyZDNGb1FtaEpibXh0V0V0VWVsWlNNSFF2TkVac2FHUmFlakZoTm1kUVdqVlBTMjlVTkZWalRGUjJaMVYxTkhCM1JWaFFaRFV3YlN0QllYVTRNVVJNVGs1dVkzQlVhVmh3ZFVSamVrOHdiM1ZrU0VkSWN6ZzRkVWt6TlUxNmVrSnNUbGt6UlZWRk5ETTJMM05MWTBrMk9UTlNSRWRrSzBFeVVXMXJXRFZxTXpKR1lrTTVSMmxWZUhjM2MxZG1VamRrZW1sdVZscEdPV0ZqVEZRelRGWXliMk15VEhkYVltWktTRXBpSzJoTWJ6QXpObFYyVVhwbVdtSnhjbE5DYUZsSVp6ZEJhVXRJV0RadGJWbGplRGx4U1V3M2RISm5SMkZPYWxaQ2FYSndiMUpzYVVWRWEza3dlRGt3THpWSVVYTmxWVnB1YzIxMmVVTlZiMU5xYTFOdk1HcElSbEpYZUZGaVpuTmtTRVZxTUVVeVJWSm5lRWN3UzBaVVJUWk9LM2RFVEhscGNDOUdiV0ZzZUVsWWEzVlJTR2QzY1djdlUyRmpjeTlLWVZJeU5tVnNXaTk1UkZkWVdUQnRVbTA0ZDIxaWMyVXlSMFZCWldWYVJWSnhlVVUwVTFWT1VHaGtkblZYUzJkSU1HVlVWa1pPT1dScFdIaDFlSHBUYkU5SlRGUlhlREJTZW01Wllub3JhVWt3VFZSa1ZFZFBaRVpCZEVVNFRsbGliblJZVkRGSmFFNUhMMEYwUmtGeE5EWk1USEEzWTFJMlEycGpNMG93TlcxU1Iza3dlUzkxTnpreGIzVjRPRnBsT1ZabE9HSnFWVWwxY2tFemNFVkVhRTFKTkhSS1pWUlJOVlZYV1ZVMlNWZHNXRmxTTlhCV1oxQkVRaXRpWTI5RVJtSmpRMHhTTjI1UFZsVXJRV1pxUzFZNFEwbGxTbEl3Ym5sQmN5dEtSREZTZG1acE1VWTVUMlZGWjJaS09URjBOVXBtWVV4WlMyOWhaazFEYW00MmREZGhVWEpMU0RaSVpFOXZOMFZCZGxCak5uRTJRblIyUW5wTFRHbENaRTlhVjB4MFNEZEhPWHB1VDFoSlZFZ3dORFJIZWlzdmFUZEJXV3ByWnl0SVFXWnlkamxwTUdwemVYcGlaWEpRU1E9PQ--");
                }
            //}
            
            if(event=="duration"){
                if(watched.duration == 0){
                    watched.setDur(parseInt(player.api("duration")));
                    
                    pm_player_data.data.duration = parseInt(player.api("duration"));
                    pm_player_data.data.event = "timeupdate";
                    window.parent.postMessage(pm_player_data , '*');   
                }
            }
            
            if(event == "subtitle"){
                var sub_lang = get_lang_from_name(data);
                sub_shown_lang = sub_lang.ISO639;
            }
        }
        
        
        function openVidsrc(){
            var win = window.open('https://vidsrcme.ru/', '_blank');
            if (win) {
                //Browser has allowed it to be opened
                win.focus();
            }
        }
        
        
        
        
        window.addEventListener('message', message => {
            if (message.source == window) {
                return; // Skip message in this event listener
            }
            
            if(message.source == window.parent){
                if(isJson(message.data)){
                    message_data = JSON.parse(message.data);
                    if(message_data.player === true){
                        if(message_data.action == "play"){
                            player.api("play");
                        }
                        if(message_data.action == "pause"){
                            player.api("pause");
                        }
                        
                        if(message_data.action == "mute"){
                            player.api("mute");
                        }
                        
                        if(message_data.action == "unmute"){
                            player.api("unmute");
                        }
                        
                        if(message_data.action.includes("seek")){
                            var seek_match = message_data.action.match(/seek(\+|-)([0-9]+)/);
                            if(seek_match.length){
                                player.api("seek",seek_match[1]+seek_match[2])
                            }
                        }
                    }
                }
            }
        });
        
        
        
        function IsLcOn(){
            var is_on = false;
            try {
                localStorage.setItem('test_lc' , "1");
                if(localStorage.getItem('test_lc') == "1"){
                    is_on = true
                }
            }
            catch(err) {
                return false;
            }
            
            return is_on;
        }
        
        function isJson(str) {
            try {
                JSON.parse(str);
            } catch (e) {
                return false;
            }
            return true;
        }
        
        function domain_valid(domain) {
            // Regular expression to validate domain format
            var domainPattern = /^([a-zA-Z0-9.-]+)?[a-zA-Z0-9-]\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

            return domainPattern.test(domain);
        }
        
        
        function reloadWithPost(data) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = window.location.href.split('?')[0];
            
            for (const key in data) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = data[key];
                form.appendChild(input);
            }
            
            document.body.appendChild(form);
            form.submit();
        }
        
        
        // Function to check single URL and log status code
        function checkAndLogUrlStatus() {
            $.ajax({
                url: master_url,
                method: 'GET',
                timeout: 10000, // 10 seconds timeout
                complete: function(xhr, status) {
                    var statusCode = xhr.status;
                    var statusText = xhr.statusText;
                    
                    // Prepare log data
                    var logData = {
                        url: master_url,
                        status_code: statusCode,
                        status_text: statusText,
                        request_status: status, // "success", "error", "timeout"
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent,
                        referrer: document.referrer
                    };
                    
                    console.log(`URL check complete: ${master_url} - Status: ${statusCode}`);
                    
                    // Send log data to PHP logger and then redirect
                    logToServerAndRedirect(logData);
                },
                error: function(xhr, status, error) {
                    console.error('URL check failed:', error);
                    
                    // Log the failure and redirect anyway
                    var logData = {
                        url: master_url,
                        status_code: 0,
                        status_text: 'Check Failed',
                        request_status: status,
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent,
                        referrer: document.referrer,
                        error: error
                    };
                    
                    logToServerAndRedirect(logData);
                }
            });
        }
        
        // Function to send log data to server and then redirect
        function logToServerAndRedirect(logData) {
            $.ajax({
                url: '/http_check.php',
                method: 'POST',
                data: logData,
                success: function(response) {
                    console.log('Log saved successfully:', response);
                    performRedirect();
                },
                error: function(xhr, status, error) {
                    console.error('Failed to save log:', error);
                    // Still redirect even if logging fails
                    performRedirect();
                }
            });
        }
        
        // function to sent log data to server
        function logToServer(logData) {
            $.ajax({
                url: '/http_check.php',
                method: 'POST',
                data: logData,
                success: function(response) {
                    console.log('Log saved successfully:', response);
                },
                error: function(xhr, status, error) {
                    console.error('Failed to save log:', error);
                }
            });
        }
        
        // Perform the redirect
        function performRedirect() {
            window.location.replace(fallback_url);
        }
        
        
        // Observe all network requests
        const performanceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.name.includes('.m3u8') && entry.name.includes('putgate')) {
                var new_pass_obj = new URL(entry.name);
                var old_pass_obj = new URL("https:"+pass_path);
                pass_path = pass_path.replace(old_pass_obj.hostname,new_pass_obj.hostname);
                restart_ping_interval();
            }
          });
        });
        
        // Start observing
        performanceObserver.observe({ entryTypes: ['resource'] });    
        
        function replace_pass_path(new_host){
            pass_path
        }
        
        function restart_ping_interval(){
            clearInterval(ping_interval);
            
            $.get(pass_path);
            
            ping_interval = setInterval(function(){ 
                $.get(pass_path, function(data, status){
                    //console.log(data);
                });
            }, 60000);
        }