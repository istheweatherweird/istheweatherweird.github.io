// Parse CSV

// get date
// var observationUrl = "https://api.weather.gov/stations/KORD/observations?start=" + year + "-" + month + "-" + date + "T00:00:00-06:00"
var observationUrl = "https://api.weather.gov/stations/KORD/observations/latest"

d3.json(observationUrl).then(function(response) {
  var obsTime = new Date(response.properties.timestamp)
  // put observation time at nearest hour
  if (obsTime.getMinutes() > 29) {
    obsTime.setTime(obsTime.getTime() + (60*60*1000))
  }

  var obsTemp = response.properties.temperature.value * 1.8 + 32;

  var pastUrl = "https://istheweatherweird.github.io/istheweatherweird-data-hourly/csv/725300-94846/" + String(obsTime.getUTCMonth()+1).padStart(2,'0') + String(obsTime.getUTCDate()).padStart(2,'0') + ".csv"
  var obsUTCHour = obsTime.getUTCHours()
  d3.csv(pastUrl,function(d) {
    if (+d.hour == obsUTCHour) {
      return {year: +d.year, temp: 32 + (+d.temp) * 0.18}
    };
  }).then(function(past) {
    // make histograms
    var highWeird = makeHist("graphWrapper", obsTemp, past, " temps in Chicago", obsTime.getFullYear())
    // var lowWeird = makeHist("minGraphWrapper", todayLow, minTemps, " lows in Chicago", "min", past)

    // make weird statement
    // if (lowWeird || highWeird) {
    if (highWeird) {
      d3.selectAll("#weird").text("YES")
      // if (lowWeird && highWeird) {
      //   "Today's high of "
      // } else {
      //
      // }
      // d3.selectAll("#sentence").text("The weather in Chicago is not weird.")
    } else {
      d3.selectAll("#weird").text("NO")
      d3.selectAll("#sentence").text("The weather in Chicago is not weird.")
    }
  });
})

data = 3

var makeHist = function(wrapperId, obs, past, title, trueYear) {
  var pastTemps = past.map(function(d) { return d.temp })
  // A formatter for counts.
  var formatCount = d3.format(",.0f");

  var margin = {top: 60, right: 30, bottom: 30, left: 30},
    width = parseInt(d3.select("#" + wrapperId).style("width")) - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;
  
  var x_with_value = d3.scaleLinear()
    .domain([Math.floor(d3.extent(pastTemps.concat(obs))[0]), Math.ceil(d3.extent(pastTemps.concat(obs))[1])])
    .range([0, width]);

    // Generate a histogram using twenty uniformly-spaced bins.
    var tickNum = 15
    var data = d3.histogram()
        .value(function(d) {return d.temp})
        .thresholds(x_with_value.ticks(tickNum))
        (past);
        
    data[0].x0 = data[0].x1-(data[1].x1 - data[0].x1)
    data[data.length-1].x1 = data[data.length-1].x0+(data[1].x1 - data[0].x1)
    var x = d3.scaleLinear()
        .domain([data[0].x0,data[data.length-1].x1])
        // .domain(d3.extent(x_with_value.ticks(tickNum)))
        .range([0,width]);

    var y = d3.scaleLinear()
        .domain([0, d3.max(data, function(d) { return d.length; })])
        .range([height, 0]);

    var xAxis = d3.axisBottom()
        .scale(x)
        .tickFormat(function(d) {return d + "F"});

    var svg = d3.select("#" + wrapperId).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("line")
        .attr("x1", x(obs))
        .attr("y1", -10)
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

    data.forEach(function(d,i) {
        d = d.sort(function(e,f) { return f.year - e.year})
        d.forEach(function(j,k) {
            svg.append("text")
            .attr("dy", ".75em")
            .attr("y", 5 + y(d.length) + k * 10)
            .attr("x", x(d.x0) + (x(d.x1) - x(d.x0)) / 2)
            .attr("text-anchor", "middle")
            // .attr("fill", "white")
            // .attr("stroke", "white")
            .text(j.year);
        })
    })

    // .append("text")
    //     .attr("dy", ".75em")
    //     .attr("y", 6)
    //     .attr("x", x(data[0].dx + x.domain()[0]) / 2)
    //     .attr("text-anchor", "middle")
    //     .text(function(d) { return formatCount(d.y); });

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    svg.append("text")
        .attr("dy", ".75em")
        .attr("y", -20)
        .attr("x", x(obs))
        .attr("text-anchor", "middle")
        .text(trueYear);

    svg.append("text")
        .attr("dy", "2em")
        .attr("y", -70)
        .attr("x", width/2)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .text(Date().substring(4,10) + title);
    
  return isweird(pastTemps,obs)
}

var isweird = function(vs,value) {
  var totalYears = vs.length
  above = vs.filter(d => d > value).length / totalYears
  below = vs.filter(d => d < value).length / totalYears
  if (above < .1) {
    return "warm"
  } else {
    if (below < .1) {
      return "cold"
    } else {
      return false
    }
  }
}


// function drawLine(data) {
//   var svgWidth =
// }
