var MOBILE_BINS_MAX = 8
var DESKTOP_BINS_MIN = 8

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

var stationDict = {
  KORD: {number: "725300-94846", place: "Chicago"},
  KJFK: {number: "744860-94789", place: "New York City"},
  KMKE: {number: "726400-14839", place: "Milwaukee"},
  KOKC: {number: "723530-13967", place: "Oklahoma City"},
  KPIT: {number: "725200-94823", place: "Pittsburgh"},
  KSFO: {number: "724940-23234", place: "San Francisco"},
  KIAD: {number: "724030-93738", place: "Washington DC"}
}

var getStation = function(place) {
  var station = null
  for (var key in stationDict) {
    if (stationDict[key].place == place) {
      station = key
      break
    }
  }
  return station
}

var lookUpObservations = function(station) {
  // get the most recent observation
  d3.json("https://api.weather.gov/stations/"+ station + "/observations/latest").then(function(response) {
    // if it doesn't have an observation, look further back
    if (response.properties.temperature.value == null) {
        d3.json("https://api.weather.gov/stations/"+ station + "/observations").then(function(newResponse) {
          var obsTime = 0
          var obsTemp = null
          for (var i = 0; i < newResponse.features.length; i++) {
            obsTemp = newResponse.features[i].properties.temperature.value  
            if (obsTemp != null) {
              obsTemp = obsTemp  * 1.8 + 32;
              obsTime = new Date(newResponse.features[i].properties.timestamp)
              break
            }
          }
          makePage(obsTime,obsTemp,station)
        })
    // otherwise, go for it!
    } else {
      var obsTime = new Date(response.properties.timestamp)
      var obsTemp = response.properties.temperature.value * 1.8 + 32;
      makePage(obsTime,obsTemp,station)
    }
  })
}

// look up static CSV with obs and use it + observed temp to make histogram
var makePage = function(obsTime,obsTemp,station) {
  // put observation time at nearest hour
  if (obsTime.getMinutes() > 29) {
    obsTime.setTime(obsTime.getTime() + (60*60*1000))
  }
  var pastUrl = "http://www.istheweatherweird.com/istheweatherweird-data-hourly/csv/" + stationDict[station].number + "/" + String(obsTime.getUTCMonth()+1).padStart(2,'0') + String(obsTime.getUTCDate()).padStart(2,'0') + ".csv"
  var obsUTCHour = obsTime.getUTCHours()
  d3.csv(pastUrl,function(d) {
    if (+d.hour == obsUTCHour) {
      return {year: +d.year, temp: 32 + (+d.temp) * 0.18}
    };
  }).then(function(past) {
    // make histograms
    var sentence = makeHist("graphWrapper", obsTemp, past, obsTime, station)
    d3.selectAll("#weird").html(sentence)

    if (phone) {
      $("#weird").css("font-size","30px")
      $('#itww-place-button').css("font-size", "30px")
    }

  });
}


var makeHist = function(wrapperId, obs, past, obsTime, station) {
  var pastTemps = past.map(function(d) { return d.temp })
  // A formatter for counts.
  var formatCount = d3.format(",.0f");

  var margin = {top: 60, right: 30, bottom: 30, left: 30}

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
            if (phone_cull && i % 2 != 0) {
                label = ""
            }

            if (i == last_label_i) {
                label += "ºF"
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
        
    svg.selectAll("rect")
      .data(data)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", 1)
      .attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; })
      .attr("width", function(d) { return x(d.x1) - x(d.x0) -1 ; })
      .attr("height", function(d) { return height - y(d.length); });

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

        
    svg.append("text")
        // .attr("dy", ".75em")
        .attr("y", -20)
        .attr("x", x(obs))
        .attr("text-anchor", "middle")
        .attr("font-size", "24px")
        .text(obsTime.getFullYear());
        
  var totalYears = pastTemps.length
  var sentence = "It's " + Math.round(obs,0) + "ºF, "
  var perc = (pastTemps.filter(d => d < obs).length / totalYears) * 100
  var typical = false
  var record = false

  if ((perc >= 25) && (perc <= 75)) {
    sentence += "<span class='itww-typical'>typical</span> for "
    typical = true
  } else {
    if (perc > 75) {
      if (perc == 100) {
        sentence += "the <span class='itww-hottest'>hottest</span> "
        record = true
      } else {
        sentence += "<span class='itww-warmer'>warmer</span> than " + Math.floor(perc / 5)*5 + "% of "
      }
    } else {
      if (perc == 0) {
        sentence += "the <span class='itww-coldest'>coldest</span> "
        record = true
      } else {
        sentence += "<span class='itww-colder'>colder</span> than " + Math.floor((100-perc) / 5)*5 + "% of "
      }
    }
  }
  sentence += obsTime.toLocaleDateString("en-US",{month: "short", day: "numeric", hour: "numeric"})
  if (!typical && !record) {
    sentence += " temperatures"
  }
  sentence += " in <div class='dropdown div-inline'><button id='itww-place-button' class='btn btn-secondary btn-lg btn-place dropdown-toggle' type='button' id='dropdownMenuButton' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>" + stationDict[station].place + "</button><div class='dropdown-menu' aria-labelledby='dropdownMenuButton'>"
  for (var key in stationDict) {
    sentence += "<a class='dropdown-item"
    if (key == station) {
      sentence += " active"
    }
    sentence += "' href='/?station=" + key + "'>" + stationDict[key].place + "</a>"
  }
  
  sentence += "</div></div>"
  if (record) {
    sentence += " on record"
  }
  sentence +=  " since " + past[0].year + "."
  return sentence
}

var phone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 


// if a station is specified, use it. otherwise, try to figure out where the user is
if (getUrlVars().station) {
  lookUpObservations(getUrlVars().station)
} else {
  var onSuccess = function(geoipResponse) {
    station = getStation(geoipResponse.city.names.en)
    if (station == null) {
      lookUpObservations("KORD")
    } else {
      lookUpObservations(station)      
    }
  };

  /* If we get an error we will */
  var onError = function (error) {
    lookUpObservations("KORD")
  };

  // this try is in case geoip2 didn't load, e.g. it was blocked by a browser privacy extension
  try { 
    geoip2.city( onSuccess, onError );
  } catch(err) {
    onError()
  }
}
