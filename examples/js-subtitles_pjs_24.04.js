function showSubtitles(){
    if ($(".subtitles").is(":visible")) {
        hide_subs();    
    }else{
        show_subs();
    }
}

function addSubtitle(sub){
    sub_shown_lang = sub.lang_short;

    var sub_url_parts = sub.url.split("?");
    var sub_url_path = sub_url_parts[0];
    
    
    var sub_string = gen_sub_string(sub);
    
    var added_sub_index;
    var added = false;
    
    for (let i = 0; i < the_subtitles.length; i++) {
        if (the_subtitles[i].includes(sub_url_path)) {
            added_sub_index = i;
            added = true;
            break; // Exit the loop early since we found the element
        }
    }
    
    //console.log(the_subtitles.length);
    //console.log(added_sub_index)
    
    if(added){
        //console.log(the_subtitles);
        player.api("subtitle" , added_sub_index);
        
    }else{
        //console.log(the_subtitles);
        the_subtitles.push(sub_string);
        player.api("subtitle",the_subtitles.join(","));
        //if(player.api("subtitles") > 1)
        player.api("subtitle" , player.api("subtitles").length-1);
        
        if(lc_on)
            localStorage.setItem("pljssubtitle",sub.lang);
    }
}





var sub_langs = JSON.parse('[{"IdSubLanguage":"afr","ISO639":"af","LanguageName":"Afrikaans","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"alb","ISO639":"sq","LanguageName":"Albanian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"ara","ISO639":"ar","LanguageName":"Arabic","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"arg","ISO639":"an","LanguageName":"Aragonese","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"arm","ISO639":"hy","LanguageName":"Armenian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"ast","ISO639":"at","LanguageName":"Asturian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"aze","ISO639":"az","LanguageName":"Azerbaijani","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"baq","ISO639":"eu","LanguageName":"Basque","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"bel","ISO639":"be","LanguageName":"Belarusian","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"ben","ISO639":"bn","LanguageName":"Bengali","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"bos","ISO639":"bs","LanguageName":"Bosnian","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"bre","ISO639":"br","LanguageName":"Breton","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"bul","ISO639":"bg","LanguageName":"Bulgarian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"bur","ISO639":"my","LanguageName":"Burmese","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"cat","ISO639":"ca","LanguageName":"Catalan","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"chi","ISO639":"zh","LanguageName":"Chinese (simplified)","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"cze","ISO639":"cs","LanguageName":"Czech","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"dan","ISO639":"da","LanguageName":"Danish","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"dut","ISO639":"nl","LanguageName":"Dutch","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"eng","ISO639":"en","LanguageName":"English","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"epo","ISO639":"eo","LanguageName":"Esperanto","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"est","ISO639":"et","LanguageName":"Estonian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"fin","ISO639":"fi","LanguageName":"Finnish","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"fre","ISO639":"fr","LanguageName":"French","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"geo","ISO639":"ka","LanguageName":"Georgian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"ger","ISO639":"de","LanguageName":"German","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"gla","ISO639":"gd","LanguageName":"Gaelic","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"gle","ISO639":"ga","LanguageName":"Irish","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"glg","ISO639":"gl","LanguageName":"Galician","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"ell","ISO639":"el","LanguageName":"Greek","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"heb","ISO639":"he","LanguageName":"Hebrew","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"hin","ISO639":"hi","LanguageName":"Hindi","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"hrv","ISO639":"hr","LanguageName":"Croatian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"hun","ISO639":"hu","LanguageName":"Hungarian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"ice","ISO639":"is","LanguageName":"Icelandic","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"ind","ISO639":"id","LanguageName":"Indonesian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"ita","ISO639":"it","LanguageName":"Italian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"jpn","ISO639":"ja","LanguageName":"Japanese","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"kan","ISO639":"kn","LanguageName":"Kannada","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"kaz","ISO639":"kk","LanguageName":"Kazakh","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"khm","ISO639":"km","LanguageName":"Khmer","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"kor","ISO639":"ko","LanguageName":"Korean","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"kur","ISO639":"ku","LanguageName":"Kurdish","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"lav","ISO639":"lv","LanguageName":"Latvian","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"lit","ISO639":"lt","LanguageName":"Lithuanian","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"ltz","ISO639":"lb","LanguageName":"Luxembourgish","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"mac","ISO639":"mk","LanguageName":"Macedonian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"mal","ISO639":"ml","LanguageName":"Malayalam","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"may","ISO639":"ms","LanguageName":"Malay","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"mni","ISO639":"ma","LanguageName":"Manipuri","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"mon","ISO639":"mn","LanguageName":"Mongolian","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"nor","ISO639":"no","LanguageName":"Norwegian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"oci","ISO639":"oc","LanguageName":"Occitan","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"per","ISO639":"fa","LanguageName":"Persian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"pol","ISO639":"pl","LanguageName":"Polish","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"por","ISO639":"pt","LanguageName":"Portuguese","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"rus","ISO639":"ru","LanguageName":"Russian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"scc","ISO639":"sr","LanguageName":"Serbian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"sin","ISO639":"si","LanguageName":"Sinhalese","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"slo","ISO639":"sk","LanguageName":"Slovak","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"slv","ISO639":"sl","LanguageName":"Slovenian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"sme","ISO639":"se","LanguageName":"Northern Sami","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"snd","ISO639":"sd","LanguageName":"Sindhi","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"spa","ISO639":"es","LanguageName":"Spanish","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"swa","ISO639":"sw","LanguageName":"Swahili","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"swe","ISO639":"sv","LanguageName":"Swedish","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"syr","ISO639":"sy","LanguageName":"Syriac","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"tam","ISO639":"ta","LanguageName":"Tamil","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"tat","ISO639":"tt","LanguageName":"Tatar","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"tel","ISO639":"te","LanguageName":"Telugu","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"tgl","ISO639":"tl","LanguageName":"Tagalog","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"tha","ISO639":"th","LanguageName":"Thai","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"tur","ISO639":"tr","LanguageName":"Turkish","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"ukr","ISO639":"uk","LanguageName":"Ukrainian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"urd","ISO639":"ur","LanguageName":"Urdu","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"vie","ISO639":"vi","LanguageName":"Vietnamese","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"rum","ISO639":"ro","LanguageName":"Romanian","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"pob","ISO639":"pb","LanguageName":"Portuguese (BR)","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"mne","ISO639":"me","LanguageName":"Montenegrin","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"zht","ISO639":"zt","LanguageName":"Chinese (traditional)","UploadEnabled":"1","WebEnabled":"1"},{"IdSubLanguage":"zhe","ISO639":"ze","LanguageName":"Chinese bilingual","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"pom","ISO639":"pm","LanguageName":"Portuguese (MZ)","UploadEnabled":"1","WebEnabled":"0"},{"IdSubLanguage":"ext","ISO639":"ex","LanguageName":"Extremaduran","UploadEnabled":"1","WebEnabled":"0"}]');




const sortLangs = (sourceArray) => {
    const sortByLocation = (a, b) => a.LanguageName.localeCompare(b.LanguageName, 'en', { numeric: false });
    return sourceArray.sort(sortByLocation);
};


sub_langs = sortLangs(sub_langs);





function show_subs(){
    subs_shown = true;
    $(".subtitles").show();
}

function hide_subs(){
    subs_shown = false;
    $(".subtitles").hide();
}



function showOpsLangs() {
    
    $(".subtitles .header #back").hide();
    $(".subtitles .header #title").html("");
    
    $(".subtitles .content").remove();
    $(".subtitles").append("<div class='content'></div>");
    
    for (let sub of sub_langs) {
        var show_lang = true;
        
        if(ds_langs.length){
            show_lang = false;
            if(ds_langs.includes(sub.ISO639)){
                show_lang = true;
            }
        }
        
        if(show_lang){
            $(".subtitles .content").append('<div class="lang" data-subkey="' + sub.IdSubLanguage + '">' + sub.LanguageName + '</div>');
        }
    };
}

function showDefaultLang(){
    if(ds_lang){
        for (let lang of sub_langs) {
            if(lang.ISO639 == ds_lang.ISO639){
                showOpsSubs(lang.IdSubLanguage);
                break;
            }
        }
    }
    
}

function get_lang_from_name(lang_name){
    var the_lang = false;
    for (let lang of sub_langs) {
        var tmp_lang_regexp = new RegExp(lang.LanguageName, "i");
        if(tmp_lang_regexp.test(lang_name)){
            the_lang = lang;
            break;
        }
    }
    
    return the_lang;
}


function get_sub_lang(sub_lang_id){
    for (let sub of sub_langs) {
        if(sub_lang_id == sub.IdSubLanguage)
            return sub;
    }
    
    return false;
}

function get_lang_from_iso639(iso639){
    for (let sub of sub_langs) {
        if(iso639 == sub.ISO639)
            return sub;
    }
    
    return false;
}
    

function showOpsSubs(subkey){
    
    sub_lang = get_sub_lang(subkey);
    
    $(".subtitles_loader").css('display', 'flex');
    
    var i = $("body").data("i");
    var s = $("body").data("s");
    var e = $("body").data("e");
    
    var is_ep = false;
    if( typeof s !== 'undefined' && typeof e !== 'undefined'){
        is_ep = true;
    }
    
    var api_url = "https://rest.opensubtitles.org";
    
    api_url += "/search";
    
    if(isNumeric(s) && isNumeric(e)){
        api_url += "/episode-"+e+"/imdbid-"+i+"/season-"+s;
    }else{
        api_url += "/imdbid-"+i;
    }
    
    api_url += "/sublanguageid-"+subkey
    
    $.ajax({
        type: 'GET',
        url: api_url ,
        contentType: "application/x-www-form-urlencoded; charset=urf-8",
        dataType: 'json',
        headers: { 'X-User-Agent': 'trailers.to-UA' } /* , 
        complete: function(xhr, textStatus) {
            if(xhr.status != 200){
                alert("Subtitles are currently unavailable.");
                $("#loading_parent").hide();
                hide_subs_dialog();
                player.play();
            }
        } */
    }).done(function(data) {
        $(".subtitles_loader").hide();
        $(".subtitles .header #back").show();
        $(".subtitles .header #back").attr("onclick","showOpsLangs()");
        $(".subtitles .header #title").html(sub_lang.LanguageName+" subtitles:");
        if(data.length === 0){
            $(".subtitles .content").html("<div><b>No subtitles found.</b></div>");
        }else{
            $(".subtitles .content").html("");
            for (let sub of data) {
                if(sub.SubFormat == "srt" || sub.SubFormat == "vtt"){
                    $(".subtitles .content").append('<div class="subtitle" data-id="'+sub.IDSubtitleFile+'" data-url="' + sub.SubDownloadLink + '" data-lang="' + sub.LanguageName + '" data-subenc="'+sub.SubEncoding+'" data-src="ops" data-subformat="'+sub.SubFormat+'" data-iso369="'+sub.ISO639+'" data-release-name="'+sub.MovieReleaseName+'" data-sub-filename="'+sub.SubFileName+'">' + sub.SubFileName + '</div>');
                }
            }
            
            
            if(sub_shown_lang != sub_lang.ISO639){
                matchSubtitle(is_ep);
            }
            
            
            
            
        }
    }).fail(function() {
        $(".subtitles_loader").hide();
        $(".subtitles .header #back").show();
        $(".subtitles .header #back").attr("onclick","showOpsLangs()");
        $(".subtitles .content").html("<div><b>Subtitles failed. Please try again later.</b></div>");
    });
}





$(document).on('click', ".subtitles .content .lang", function() {
    showOpsSubs($(this).data("subkey"));
});





$(document).ready(function() {
    $(document).on('click', ".subtitles .subtitle", function() {
        getSubtitle($(this));
    });
});


function matchSubtitle(is_ep){
    var sub_found = false;
                    
    var flnm_data_filtered = [];
    
    var flnm_group = false;
    var flnm_source = false;
    
    for(const i in flnm_data){
        //console.log(flnm_data);
        
        var data_ok = true;
        if(
            typeof flnm_data[i].group === 'undefined' &&
            typeof flnm_data[i].source === 'undefined' 
            ){
            data_ok = false;
        }
        if(typeof flnm_data[i].group !== 'undefined'){
                flnm_group = flnm_data[i].group;
        }
        
        if(typeof flnm_data[i].source !== 'undefined'){
                flnm_source = flnm_data[i].source;
        }
        
        if(is_ep){
            if(
                typeof flnm_data[i].season === 'undefined' || 
                typeof flnm_data[i].episode === 'undefined'
                ){
                data_ok = false;
            }
        }
        
        if(data_ok){
            flnm_data_filtered.push(flnm_data[i]);
        }
    }
    
    flnm_data = flnm_data_filtered;
    
    for(const i in flnm_data){
        if(flnm_group.length > 0 && flnm_data[i].group === 'undefined')
            flnm_data[i].group = flnm_group;
        if(flnm_source.length > 0 && flnm_data[i].source === 'undefined')
            flnm_data[i].source = flnm_source;
    }
    
    
    console.log(flnm_data);
    
    $(".subtitles .content .subtitle").each(function() {
        var release_name = $(this).data("release-name").split("-"+sub_lang.IdSubLanguage)[0];
        var sub_filename = removeExtension($(this).data("sub-filename")).split("-"+sub_lang.IdSubLanguage)[0];
        
        var tprs_release_data = tprs.parse(release_name);
        var tprs_filename_data = tprs.parse(sub_filename);
        
        var tprs_sub_data = combineObjects(tprs_filename_data , tprs_release_data);
        
        
        for(const i in flnm_data){
            
            var is_ep_ok = true;
            
            if(is_ep){
                if(
                flnm_data[i].season != tprs_sub_data.season ||
                flnm_data[i].episode != tprs_sub_data.episode){
                    is_ep_ok = false;
                }
            }
        
            if(
                flnm_data[i].group == tprs_sub_data.group &&
                flnm_data[i].source == tprs_sub_data.source && 
                is_ep_ok
                ){
                sub_found = true;
                break;
            }
        }
        
        if(sub_found){
            //console.log(release_name);
            getSubtitle($(this));
            return false;
        }
    });
    
    if(!sub_found){
        $(".subtitles .content .subtitle").each(function() {
            var release_name = $(this).data("release-name").split("-"+sub_lang.IdSubLanguage)[0];
            var sub_filename = removeExtension($(this).data("sub-filename")).split("-"+sub_lang.IdSubLanguage)[0];
            
            var tprs_release_data = tprs.parse(release_name);
            var tprs_filename_data = tprs.parse(sub_filename);
            
            var tprs_sub_data = combineObjects(tprs_filename_data , tprs_release_data);
            
            
            //console.log(release_name);
            //console.log(sub_filename);
            //console.log(tprs_sub_data);
            
            
            for(const i in flnm_data){
                
                var is_ep_ok = true;
                
                if(is_ep){
                    if(
                    flnm_data[i].season != tprs_sub_data.season ||
                    flnm_data[i].episode != tprs_sub_data.episode){
                        is_ep_ok = false;
                    }
                }
            
                if(
                    flnm_data[i].source == tprs_sub_data.source && 
                    is_ep_ok
                    ){
                    sub_found = true;
                    break;
                }
            }
            
            if(sub_found){
                getSubtitle($(this));
                return false;
            }
        });
    }
    
    if(!sub_found){
        $(".subtitles .content .subtitle").each(function() {
            var release_name = $(this).data("release-name");
            var tprs_data_tmp = tprs.parse(release_name);
            
            //console.log(release_name);
            //console.log(tprs_data_tmp);
        });
    }
}

function getSubtitle(sub_el){
    $(".subtitles_window .content .subtitle_active").removeClass("subtitle_active");
    
    $(".subtitles_loader").css('display', 'flex');

    var sub_url = sub_el.data("url");
    var sub_lang = sub_el.data("lang");
    var sub_enc = sub_el.data("subenc");
    var sub_id = sub_el.data("id");
    var sub_src = sub_el.data("src");
    var subformat = sub_el.data("subformat");
    var sub_iso369 = sub_el.data("iso369");
    
    var xhr = new XMLHttpRequest();
    
    //sub_url = sub_url.replace("/src-api/","/src-api/subencoding-utf8/subformat-vtt/");
    //sub_url = sub_url.replace("/src-api/","/src-api/subformat-vtt");
    
    xhr.open("GET", sub_url, true);
    
    xhr.responseType = 'arraybuffer';
    xhr.addEventListener('load',function(){
        if (xhr.status === 200){
            
            var vtt_string = pako.inflate(xhr.response, { to: 'string' });
            
            if(vtt_string.substr(0,6) == "WEBVTT" && 1==2){
                var vtt_blob = new Blob([vtt_string], { type: 'text/vtt' });
                var vtt_url = URL.createObjectURL(vtt_blob);
                
                $(".subtitles_loader").css('display', 'none');
                    
                sub_url = vtt_url;
                var imdb = $("body").data("i");
                var current_sub_data = {
                    lang: sub_lang,
                    lang_short: sub_iso369 ,
                    url: sub_url+"?ext=.vtt"
                };
                addSubtitle(current_sub_data);
                hide_subs();
                
            }else{
                var file_gz_blob = new Blob([xhr.response]);
                var post_data = new FormData();
                post_data.append('sub_data', file_gz_blob);
                post_data.append('sub_id', sub_id);
                post_data.append('sub_enc', sub_enc);
                post_data.append('sub_src', sub_src);
                post_data.append('subformat', subformat);
                
                $.ajax({
                    type: 'POST',
                    url: '/get_sub_url',
                    data: post_data,
                    processData: false,
                    contentType: false
                }).done(function(data) {
                    $(".subtitles_loader").css('display', 'none');
                    
                    sub_url = data;
                    var imdb = $("body").data("i");
                    var current_sub_data = {
                        lang: sub_lang,
                        lang_short: sub_iso369 ,
                        url: sub_url.replace(".srt",".vtt")+"&ext=.vtt"
                    };
                    
                    if(IsLcOn()){
                        localStorage.setItem(current_sub_name, JSON.stringify(current_sub_data));
                    }
                    
                    addSubtitle(current_sub_data);
                    sub_el.addClass("subtitle_active");
                    
                    hide_subs();
                    
                }).fail(function() { 
                    alert('request failed');
                });
            }
        }else{
            alert("Subtitle load failed. Please try again later.");
            $(".subtitles_loader").css('display', 'none');
        }
    })
    xhr.send();
}

function gen_sub_string(sub_data){
    var tmp_lang = sub_data.lang;
    var br = 2;
    
    while(player.api("subtitles").includes(tmp_lang)){
        tmp_lang = sub_data.lang+" "+br;
        br++;
    }
    
    sub_data.lang = tmp_lang;
    
    if(sub_data.url.substr(0, 4) === "http"){
        return "["+sub_data.lang+"]"+sub_data.url;
    }else{
        return "["+sub_data.lang+"]"+"//"+location.hostname+sub_data.url;
    }
}



function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}
function isNumeric(value) {
    return /^-?\d+$/.test(value);
}

function gen_subs_el(subSettings = true){
    $("#player_parent #oframeplayer_parent").append("<div class='subtitles_window subtitles'></div>");
    $(".subtitles").append("<div class='subtitles_loader'></div>");
    $(".subtitles").append("<div class='header'></div>");
    $(".subtitles").append("<div class='content'></div>");
    $(".subtitles .header").append('<i id="back" class="fa-solid fa-arrow-left"></i>');
    $(".subtitles .header").append('<span id="title"></span>');
    $(".subtitles .header").append('<i id="close" class="fa-solid fa-xmark"></i>');
    $(".subtitles .header #close").attr("onclick","hide_subs()");
    
    showOpsLangs();
    showDefaultLang();
    $("#player_parent_control_showSubtitles").show();
}

function setStartSubtitle(){
    var subtitles = player.api("subtitles");
    
    var tmp_lang_regexp = new RegExp(ds_lang.LanguageName, "i");
    
    
    for(key in subtitles){
        if(tmp_lang_regexp.test(subtitles[key])){
            sub_shown_lang = ds_lang.ISO639
            subtitle_key = key;
            break;
        }
    }
    
    
    player.api("subtitle" , subtitle_key);
}



window.addEventListener('click', function(e){  
    var is_subtitles_window  = false;

    $('.subtitles_window').each(function(i, obj) {
        if(obj.contains(e.target)){
            is_subtitles_window = true;
        }
    });
    
    if(e.target.getAttribute("class") != "lang"){
        if (
            !$("#player_parent_control_showSubtitles")[0].contains(e.target) &&
            !$(".subtitles_window")[0].contains(e.target)
        ){
            hide_subs();
        }
    }
});

function subs_error(){
    $(".subtitles .header #back").show();
    $(".subtitles .content").html("<div>No subtitles.</div>");
}



function array_count(array){
    let count = 0;

    for (const key in array) {
        if (array.hasOwnProperty(key)) {
            count++;
        }
    }
    
    return count;
}

function removeExtension(fileName) {
    return fileName.split('.').slice(0, -1).join('.');
}

function combineObjects(objA, objB) {
    for (let key in objB) {
        if (!objA.hasOwnProperty(key)) {
            objA[key] = objB[key];
        }
    }
    return objA;
}