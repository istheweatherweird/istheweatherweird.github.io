// ------
// CONFIG
// -----
var MOBILE_BINS_MAX = 6
var DESKTOP_BINS_MIN = 9
var DEFAULT_STATION = "KORD"
var min_years = 25
// var DATA_URL = "https://www.istheweatherweird.com/istheweatherweird-data-hourly"
var DATA_URL = "https://www.istheweatherweird.com/itww-data-multiscale"
https://github.com/istheweatherweird/itww-data-multiscale/tree/main/csv
// "https://github.com/istheweatherweird/itww-data-multiscale/tree/main/csv/multiscale/722190-13874"
// "https://www.istheweatherweird.com/itww-data-multiscale/csv/multiscale/722190-13874/0101.csv"
// var stations_url = DATA_URL + "/csv/stations.csv"
var stations_url = "https://www.istheweatherweird.com/istheweatherweird-data-hourly/csv/stations.csv"
var intervals = ["hour","day","week","month","year"]
var intervalPhrases = {
  hour: "right now",
  day: "in the past day",
  week: "in the past week",
  month: "in the past month",
  year: "in the past year"
}
var intervalColumn = {
  hour: "obs",
  day: "D1",
  week: "D7",
  month: "D30",
  year: "D365"
}
var weirdnessTexts = [
  'typical', 
  'a bit weird',
  'weird',
  'very weird'
]
var gradientFrac = .1 // fraction of the range to make each gradient (max should be 1/smallest number of bars)
var phone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 

// -------
// HELPERS
// -------
// helper for parsing URL
var getUrlVars = function() {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function roundMinutes(date) {
    date = new Date(date.getTime())
    date.setHours(date.getHours() + Math.round(date.getMinutes()/60));
    date.setMinutes(0);

    return date;
}

var getNearestStation = function(geoip, placeMap) {
    placeMap.each(function(value, key) {
        // return the place closest to the geoipResponse
        value.distance = distance(
            +geoip.latitude,
            +geoip.longitude,
            +value.LAT,
            +value.LON)
    });
    
    return d3.entries(placeMap)
        .sort(function(a, b) {
            return d3.ascending(a.value.distance, b.value.distance); })[0].value;
}

var setUnits = function(place) { return (place.CTRY == "US" ? "F" : "C") };

var quantile = function(arr, q) {
  var sorted = arr.sort(function(a,b) { return a-b; });
  var pos = (sorted.length - 1) * q;
  var base = Math.floor(pos);
  var rest = pos - base;
  if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
      return sorted[base];
  }
};

// -------------
// BIG FUNCTIONS
// -------------

// Look up observations - the step where we get the data and preprocess it before making the page
var lookUpObservations = function(place,units,interval) {
  if (!units) { units = setUnits(place) }

  if (interval == "hour") {
    // get the most recent observation
    d3.json("https://api.weather.gov/stations/"+ place.ICAO + "/observations/latest").then(function(response) {
      // if it doesn't have an observation, look further back
      if (response.properties.temperature.value == null) {
          d3.json("https://api.weather.gov/stations/"+ place.ICAO + "/observations").then(function(newResponse) {
            // filter to non-null temps
            var features = newResponse.features.filter(function(x) {return x.properties.temperature.value != null})
            if (features.length > 0) {
                // sort chronologically
                features = features.sort(function(x,y) {
                    return d3.descending(x.properties.timestamp, y.properties.timestamp) })
                feature = features[0]
                var obsTime = new Date(feature.properties.timestamp)
                var obsTemp = feature.properties.temperature.value
                makePage(obsTime,obsTemp,place,units,interval)
            }
          })
      // otherwise, go for it!
      } else {
        var obsTime = new Date(response.properties.timestamp)
        var obsTemp = response.properties.temperature.value
        makePage(obsTime,obsTemp,place,units,interval)
      }
    })
  } else {
    // var histUTCHour = histTime.getUTCHours()
    d3.csv(DATA_URL + "/csv/latest/" + place.USAF + "-" + place.WBAN + ".csv",function(d) {
      if (d.timescale == intervalColumn[interval]) {
        var obsTime = new Date(d.timestamp)
        makePage(obsTime,d.temp,place,units,interval)
      }
      // if ((+d.hour == histUTCHour) && (d[intervalColumn[interval]])) {
      //   return {
      //     year: +d.year, 
      //     temp: (units== "C") ? (+d[intervalColumn[interval]]) * 0.1 : 32 + (+d[intervalColumn[interval]]) * 0.18
      //   }
      // };
    })
  }
}

// look up static CSV with obs and use it + observed temp to make histogram
var makePage = function(obsTime, obsTemp, place, units, interval) {
  if (units == "F") { obsTemp = obsTemp * 1.8 + 32; }
  // put hist time at nearest hour
  var histTime = roundMinutes(obsTime)
  id = place.USAF + "-" + place.WBAN
  // csv/multiscale/722190-13874/0101.csv
  // var pastUrl = DATA_URL + "/csv/" + id + "/" + String(histTime.getUTCMonth()+1).padStart(2,'0') + String(histTime.getUTCDate()).padStart(2,'0') + ".csv"
  // https://www.istheweatherweird.com/istheweatherweird-data-hourly/csv/037720-99999/0407.csv
  // https://www.istheweatherweird.com/itww-data-multiscale/csv/multiscale/722190-13874/0407.csv
  // https://www.istheweatherweird.com/itww-data-multiscale/csv/multiscale/037720-99999/0407.csv
  // var pastUrl = "https://www.istheweatherweird.com/istheweatherweird-data-hourly/csv/" + id + "/" + String(histTime.getUTCMonth()+1).padStart(2,'0') + String(histTime.getUTCDate()).padStart(2,'0') + ".csv"
  var pastUrl = DATA_URL + "/csv/isd/" + id + "/" + String(histTime.getUTCMonth()+1).padStart(2,'0') + String(histTime.getUTCDate()).padStart(2,'0') + ".csv"
  var histUTCHour = histTime.getUTCHours()

  d3.csv(pastUrl).then(function(data) {
    var possibleIntervals = intervals.filter(function(i) {
      totalYears = data.filter(function(r) { return ((+r.hour == histUTCHour) && (r[intervalColumn[i]]))})
      return totalYears.length >= min_years
    })

    if (!(possibleIntervals.includes(interval))) {
      location.href = "/?station=" + place.ICAO + '&units=' + units + '&interval=hour'
    }
    
    var past = data.filter(function(d) {return ((+d.hour == histUTCHour) && (d[intervalColumn[interval]]))}).map(function(d){ 
      return {
        year: +d.year, 
        temp: (units== "C") ? (+d[intervalColumn[interval]]) * 0.1 : 32 + (+d[intervalColumn[interval]]) * 0.18
      }
    })
    var wrapperElem = document.getElementById("loaderWrapper");
    wrapperElem.parentNode.removeChild(wrapperElem);
    document.getElementById("timeSeriesButtonWrapper").style.display = "block";
    // make histograms
    d3.select("#weird").html(makeHist("graphWrapper", obsTemp, past, obsTime, place, histTime, units, interval, possibleIntervals))
    // make notes for the bottom
    d3.select("#notes").text('Notes:').append('ul').append('li').text(`Weather station: ${place['STATION NAME']}`).append('li').text(`NWS API last observation: ${obsTime.toLocaleDateString("en-US",{hour: "numeric", minute:"numeric", timeZone: place.TZ})}`).append('li').text(`NOAA ISD history: ${past.length} observations since ${past[0]['year']}`).append('li').text(`Timezone: ${place.TZ}`)

    if (phone) {
      $("#weird").css("font-size","30px")
      $('#itww-place-button').css("font-size", "30px")
      $('#itww-interval-button').css("font-size", "30px")
    }
  });
}

var makeHist = function(wrapperId, obs, past, obsTime, place, histTime, units, interval, possibleIntervals) {
  var pastTemps = past.map(function(d) { return d.temp })

  var margin = {top: 60, right: 30, bottom: 50, left: 30}

  var width = parseInt(d3.select("#" + wrapperId).style("width")) - margin.left - margin.right

  var allTemps = pastTemps.concat(obs)
  var tempExtent = d3.extent(allTemps)

  x_with_value = d3.scaleLinear()
    .domain([Math.floor(tempExtent[0]),
             Math.ceil(tempExtent[1])])
    .range([0, width]);
   
    var tickNum = d3.thresholdFreedmanDiaconis(allTemps, tempExtent[0], tempExtent[1])
    if (phone) {
      tickNum = Math.min(tickNum, MOBILE_BINS_MAX)
    } else {
      tickNum = Math.max(tickNum, DESKTOP_BINS_MIN)
    }

    var ticks = x_with_value.ticks(tickNum)
    var data = d3.histogram()
        .value(function(d) {return d.temp})
        .thresholds(ticks)
        (past.concat({temp: obs, year: obsTime.getUTCFullYear()}));
        
    data = data.map(function(ar) {
      var tempAr = ar.filter(function(yr) { return yr.year != obsTime.getUTCFullYear() })
      tempAr.x0 = ar.x0
      tempAr.x1 = ar.x1
      return tempAr
    })
        
    data[0].x0 = data[0].x1-(data[1].x1 - data[0].x1)
    data[data.length-1].x1 = data[data.length-1].x0+(data[1].x1 - data[0].x1)
    var x = d3.scaleLinear()
        .domain([data[0].x0,data[data.length-1].x1])
        // .domain(d3.extent(x_with_value.ticks(tickNum)))
        .range([0,width]);

    // the maximum number of observations in a bin
    maxFreq = d3.max(data, function(d) { return d.length; })
    if (phone) {
      var height = 350 - margin.top - margin.bottom
    } else {
      // on dekstop height is maxFreq * 24 to make room for years text
      var height = maxFreq * 24
    }

    var y = d3.scaleLinear()
        .domain([0, maxFreq])
        .range([height, 0]);

    // index of last tick for adding dF to label
    var last_label_i = data.length
    var phone_cull = phone && (data.length > MOBILE_BINS_MAX)
    // when number of bins is even and we've culled, last tick is unlabeled
    if (phone_cull && data.length % 2 == 1) {
        last_label_i -= 1
    }
    var xAxis = d3.axisBottom()
        .scale(x)
        .ticks(data.length+1)
        .tickFormat(function(d, i) {
            var label = ""
            label += d
            if (phone_cull && i % 2 != 0) { label = "" }
            if (i == last_label_i) {
                label += "º" + units
            }
            return label
        });

    var svg = d3.select("#" + wrapperId).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("line")
        .attr("x1", x(obs))
        .attr("y1", -20)
        .attr("x2", x(obs))
        .attr("y2", height)
        .attr("stroke-width", 2)
        .attr("opacity", 0.5)
        .attr("stroke", "black");
    
  var totalYears = pastTemps.length
  
  var weirdnessFunc = function(n) {
    var perc = (pastTemps.filter(d => d < n).length / totalYears) * 100
    var warm = perc >= 50
    var percRel = warm ? perc : 100 - perc
    percRel = Math.round(percRel, 0)  
    var weirdness = 0
    var record = false
    if (percRel >= 97.5) {
        weirdness = 3
        if (percRel == 100) {
            record = true
        }
    } else if (percRel >= 90) {
        weirdness = 2
    } else if (percRel >= 80) {
        weirdness = 1
    }
    return [warm,weirdness,record,percRel];
  }

  var compTexts = [
    ['colder', 'coldest'],
    ['warmer', 'warmest']
  ]

  var weirdnessClass = function(warm,weirdness,record) {
    // use unary + to convert boolean to integer for indexing
    var compText = compTexts[+warm][+record]
    var style = weirdness == 0 ? 'typical' : compText
    return [compText,style]
  }

  var defs = svg.append("defs");

  var coldestBar = data[0].x0 // the coldest value of the coldest bar
  // var weirdColder = quantile(pastTemps,.1) // transition temperature from weird cold to typical
  var weirdCold = quantile(pastTemps,.2) // transition temperature from weird cold to typical
  var weirdWarm = quantile(pastTemps,.8) // transition temperature from weird warm to typical
  // var weirdWarmer = quantile(pastTemps,.9) // transition temperature from weird warm to typical
  var warmestBar = data[data.length-1].x1 // the warmest value of the warmest var
  // var weirdColerBeforePerc = (((weirdColder - coldestBar) / (warmestBar - coldestBar)) - (gradientFrac / 2)) * 100
  // var weirdColerAfterPerc = (((weirdColder - coldestBar) / (warmestBar - coldestBar)) + (gradientFrac / 2)) * 100
  var weirdColdBeforePerc = (((weirdCold - coldestBar) / (warmestBar - coldestBar)) - (gradientFrac / 2)) * 100
  var weirdColdAfterPerc = (((weirdCold - coldestBar) / (warmestBar - coldestBar)) + (gradientFrac / 2)) * 100
  var weirdWarmBeforePerc = (((weirdWarm - coldestBar) / (warmestBar - coldestBar)) - (gradientFrac / 2)) * 100
  var weirdWarmAfterPerc = (((weirdWarm - coldestBar) / (warmestBar - coldestBar)) + (gradientFrac / 2) ) * 100
  // var weirdWarmerBeforePerc = (((weirdWarmer - coldestBar) / (warmestBar - coldestBar)) - (gradientFrac / 2)) * 100
  // var weirdWarmerAfterPerc = (((weirdWarmer - coldestBar) / (warmestBar - coldestBar)) + (gradientFrac / 2) ) * 100


  svg.selectAll("rect")
    .data(data)
    .enter().append("rect")
      .attr("x", 1)
      .attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; })
      .attr("width", function(d) { return x(d.x1) - x(d.x0) ; })
      .attr("stroke","rgb(101, 101, 101)")
      .attr("shape-rendering", "crispEdges")
      .attr("height", function(d) { return height - y(d.length); })
      .attr("fill",function(d,i) {
        var gradient = defs.append("linearGradient")
          .attr("id", "svgGradient" + i)
          .attr("x1", (((coldestBar - d.x0) / (d.x1 - d.x0)) * 100) + "%")
          .attr("x2", (((warmestBar - d.x0) / (d.x1 - d.x0)) * 100) + "%")
          .attr("y1", "50%")
          .attr("y2", "50%");

        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "rgba(230.4, 243.3, 247.5, 1.0)")
          .attr("stop-opacity", 1);

        gradient.append("stop")
          .attr("offset", weirdColdBeforePerc + "%")
          .attr("stop-color", "rgba(230.4, 243.3, 247.5, 1.0)")
          .attr("stop-opacity", 1);

        gradient.append("stop")
          .attr("offset", weirdColdAfterPerc + "%")
          .attr("stop-color", "rgba(241.8, 241.8, 241.8, 1.0)")
          .attr("stop-opacity", 1);

        gradient.append("stop")
          .attr("offset", weirdWarmBeforePerc + "%")
          .attr("stop-color", "rgba(241.8, 241.8, 241.8, 1.0)")
          .attr("stop-opacity", 1);

        gradient.append("stop")
          .attr("offset", weirdWarmAfterPerc + "%")
          .attr("stop-color", "rgba(255.0, 208.2, 199.8, 1.0)")
          .attr("stop-opacity", 1);

        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "rgba(255.0, 208.2, 199.8, 1.0)")
          .attr("stop-opacity", 1);

        return "url(#svgGradient" + i + ")"
      })
      // .attr("class", function(d) { 
      //   // console.log(weirdnessFunc((d.x1 + d.x0)/2))

      //   var w_ar = weirdnessFunc((d.x1 + d.x0)/2);
      //   var w_c_ar = weirdnessClass(w_ar[0],w_ar[1],false)
      //   return "bar itww-" + w_c_ar[1]
      // });

      if (!phone) {
        data.forEach(function(d,i) {
            d = d.sort(function(e,f) { return f.year - e.year})
            d.forEach(function(j,k) {
                svg.append("text")
                .attr("dy", ".75em")
                .attr("y", 5 + y(d.length) + k * 24)
                .attr("x", x(d.x0) + (x(d.x1) - x(d.x0)) / 2)
                .attr("text-anchor", "middle")
                //.attr("fill", "white")
                //.attr("stroke", "white")
                .text(j.year);
            })
        })
        
      }

    svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

        
    var weirdness_array = weirdnessFunc(obs)
    var weirdness = weirdness_array[1]
    var record = weirdness_array[2]
    var percRel = weirdness_array[3]
    var weirdnessText = weirdnessTexts[weirdness]

    var weirdnessClassAr = weirdnessClass(weirdness_array[0],weirdness,record)
    var compText = weirdnessClassAr[0]
    var style = weirdnessClassAr[1]
    
    var weirdnessTextStyle = function(val) {
      var war = weirdnessFunc(val)
      return weirdnessClass(war[0],war[1],war[2])[1]
    }

    svg.append("text")
      .attr("y", -20)
      .attr("x", x(obs))
      .attr("text-anchor", "middle")
      .attr("font-size", "24px")
      .attr("class","itww-" + style)
      .text(obsTime.getFullYear());
 
    var histTimeText = histTime.toLocaleDateString("en-US",{month: "short", day: "numeric", hour: "numeric", timeZone: place.TZ})
    var obsInterval = interval == "hour" ? `${histTimeText} Temperatures` : `Temperatures for the ${interval} ending ${histTimeText}`
    svg.append("text")      // text label for the x axis
            .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.bottom - 5) + ")")
            .style("text-anchor", "middle")
            .text(obsInterval);
            // .text(histTimeText + " Temperatures");


  // if (makeTimeSeries) {
      var timeSeriesYearHeight = 14
      var timeSeriesWidth = parseInt(d3.select("#timeSeriesWrapper").style("width")) - margin.left - margin.right
      var timeSeriesHeight = past.length * timeSeriesYearHeight

      var timeSeriesSvg = d3.select("#timeSeriesWrapper").append("svg")
      .attr("width", timeSeriesWidth + margin.left + margin.right)
      .attr("height", timeSeriesHeight + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      timeSeriesSvg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + timeSeriesHeight + ")")
      .call(xAxis);

      timeSeriesSvg.append("text")
      .attr("y", -5)
      .attr("x", x(obs))
      .attr("text-anchor", "middle")
      .attr("font-size", "20px")
      .attr("class","itww-" + style)
      .text(obsTime.getFullYear());
      

    var timeSeriesY = d3.scaleLinear()
      .domain([0, past.length])
      .range([timeSeriesHeight, 0]);
    
    var timeSeriesTextWidth = (warmestBar - coldestBar)/timeSeriesYearHeight

    past.forEach(function(j,k) {
      var textLoc = x(j.temp)
      var textGradient = defs.append("linearGradient")
      .attr("id", "textGradient" + k)
      .attr("x1", (((coldestBar - (j.temp - timeSeriesTextWidth/2)) / timeSeriesTextWidth) * 100) + "%")
      .attr("x2", (((warmestBar - (j.temp - timeSeriesTextWidth/2)) / timeSeriesTextWidth) * 100) + "%")
      .attr("y1", "50%")
      .attr("y2", "50%");

    textGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "rgba(173.0, 216.0, 230.0, 1.0)")
      .attr("stop-opacity", 1);

    textGradient.append("stop")
      .attr("offset", weirdColdBeforePerc + "%")
      .attr("stop-color", "rgba(173.0, 216.0, 230.0, 1.0)")
      .attr("stop-opacity", 1);

    textGradient.append("stop")
      .attr("offset", weirdColdAfterPerc + "%")
      .attr("stop-color", "rgba(128.0, 128.0, 128.0, 1.0)")
      .attr("stop-opacity", 1);

    textGradient.append("stop")
      .attr("offset", weirdWarmBeforePerc + "%")
      .attr("stop-color", "rgba(128.0, 128.0, 128.0, 1.0)")
      .attr("stop-opacity", 1);

    textGradient.append("stop")
      .attr("offset", weirdWarmAfterPerc + "%")
      .attr("stop-color", "rgba(255.0, 99.0, 71.0, 1.0)")
      .attr("stop-opacity", 1);

    textGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "rgba(255.0, 99.0, 71.0, 1.0)")
      .attr("stop-opacity", 1);
      timeSeriesSvg.append("text")
        .attr("dy", ".5em") // .75em")
        .attr("y", 5 + timeSeriesY(past.length) + (past.length - k - 1) * timeSeriesYearHeight)
        .attr("x", textLoc)
        .attr("text-anchor", "middle")
        .attr("fill","url(#textGradient" + k + ")")
        .attr("font-size", "14px")
        // .attr("class","itww-" + weirdnessTextStyle(j.temp))
          //.attr("fill", "white")
          //.attr("stroke", "white")
          .text(j.year);
      })

      var x = document.getElementById("timeSeriesWrapper");
      x.style.display = "none";
      // past
  // }
            


  var placeDropdownHtml = "<div class='dropdown div-inline'><button id='itww-place-button' class='btn btn-secondary btn-lg btn-place dropdown-toggle' type='button' id='dropdownMenuButton' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>" + place.place + "</button><div class='dropdown-menu' aria-labelledby='dropdownMenuButton'>"
  placeMap.each(function(p) {
    placeDropdownHtml += "<a class='dropdown-item"
    if (p.ICAO == place.ICAO) {
      placeDropdownHtml += " active"
    }
    placeDropdownHtml += "' href='/?station=" + p.ICAO + "&units=" + units + "&interval=" + interval + "'>" + p.place + "</a>"
  });
  placeDropdownHtml += "</div></div>"

  var intervalDropdownHtml = "<div class='dropdown div-inline'><button id='itww-interval-button' class='btn btn-secondary btn-lg btn-place dropdown-toggle' type='button' id='intervalDropdownMenuButton' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>" + intervalPhrases[interval] + "</button><div class='dropdown-menu' aria-labelledby='intervalDropdownMenuButton'>"
  possibleIntervals.forEach(function(i) {
    intervalDropdownHtml += "<a class='dropdown-item"
    if (i == interval) {
      intervalDropdownHtml += " active"
    }
    intervalDropdownHtml += "' href='?station=" + place.ICAO + "&units=" + units + "&interval=" + i + "'>" + intervalPhrases[i] + "</a>"
  });
  intervalDropdownHtml += "</div></div>"
  var obsRound = Math.round(obs, 0)

  var weirdnessHtml = `<span class='itww-${style}'>${weirdnessText}</span>`
  // only style the comparative if its not typical
  var compHtml = weirdness == 0 ? compText : `<span class='itww-${style}'>${compText}</span>`
  var verbTense = interval == "hour" ? "is" : "was"
  var obsVerb = interval == "hour" ? "It's" : "It was"
  var obsAvg = interval == "hour" ? "" : " on average"
  obsInterval = obsInterval.replace("Temperatures", "temperatures")
  
  var unitHtml = `<div class='dropdown div-inline'><button id='itww-units-button' class='btn btn-secondary btn-lg btn-units dropdown-toggle' type='button' id='dropdownMenuButton' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>º` + units + `</button><div class='dropdown-menu' aria-labelledby='dropdownMenuButton'><a class='dropdown-item${(units == "F") ? " active" : ""}' href='/?station=` + place.ICAO + "&units=F&interval=" + interval + `'>ºF</a><a class='dropdown-item${(units == "C") ? " active" : ""}' href='/?station=` + place.ICAO + "&units=C&interval=" + interval + "'>ºC</a></div></div>"

  var sentence1 = `The weather in ${placeDropdownHtml} ${verbTense} ${weirdnessHtml} ${intervalDropdownHtml}.` 
  var sentence2 = ''
  if (!record) {
    // sentence2 += `It's ${obsRound}${unitHtml}, ${compHtml} than ${percRel}% of ${histTimeText} temperatures on record.`
    sentence2 += `${obsVerb} ${obsRound}${unitHtml}${obsAvg}, ${compHtml} than ${percRel}% of ${obsInterval} on record.`
  } else {
    // sentence2 += `It's ${obsRound}${unitHtml}, the ${compHtml} ${histTimeText} temperature on record.`
    obsInterval = obsInterval.replace("temperatures", "temperature")
    sentence2 += `${obsVerb} ${obsRound}ºF${obsAvg}, the ${compHtml} ${obsInterval} on record.`
  }
  return sentence1 + ' <br/><span style="font-size:25px">' + sentence2 + '</span>'
}

// --------------
// THE MAIN EVENT
// --------------
// load a csv with the list of all the stations,
// and based on the results, call lookUpObservations()
d3.csv(stations_url).then(function(data) {
    placeMap = d3.map(data, function(d) { return d.ICAO })
    var interval = ('interval' in getUrlVars()) ? getUrlVars().interval : "hour"
    var onError = function(error) { lookUpObservations(placeMap.get(DEFAULT_STATION),"F","hour") };
    var station = getUrlVars().station
    var units = getUrlVars().units
    if (station) {
        place = placeMap.get(station)
        place ? lookUpObservations(place,units,interval) : onError()
    } else {
        $.getJSON("https://get.geojs.io/v1/ip/geo.json", function(geoip) {
            place = getNearestStation(geoip, placeMap)
            lookUpObservations(place,units,interval)
        }).fail(function() { onError() })
    }
});


// time series button
function showTimeSeries() {
  var x = document.getElementById("timeSeriesWrapper");
  var y = document.getElementById("timeSeriesButton");
  if (x.style.display === "none") {
    x.style.display = "block";
    y.innerHTML = "Hide time series"
  } else {
    x.style.display = "none";
    y.innerHTML = "Show time series"
  }
} 
