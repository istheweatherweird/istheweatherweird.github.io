// Parse CSV

// get date
const now = new Date()
const year = now.getFullYear()
const month = now.getMonth() + 1
const date = now.getDate()

var observationUrl = "https://api.weather.gov/stations/KORD/observations?start=" + year + "-" + month + "-" + date + "T00:00:00-06:00"

d3.json(observationUrl).then(function(response) {
  var observedTemps = response.features.map(function(d) { return d.properties.temperature.value * 1.8 + 32 });
  var lonlat = response.features[0].geometry.coordinates
  var forecastUrl = "https://api.weather.gov/points/" + lonlat[1] + "," + lonlat[0] + "/forecast/hourly"
  d3.json(forecastUrl).then(function(response) {
    period = response.properties.periods;
    var forecastHours = 24-period[0].startTime.substring(11,13)
    var forecastTemps = period.slice(0,24-period[0].startTime.substring(11,13)).map(function(d) { return d.temperature });
    var temps = observedTemps.concat(forecastTemps)
    var todayLow = d3.min(temps)
    var todayHigh = d3.max(temps)
    var pastUrl = "https://istheweatherweird.github.io/istheweatherweird-data/csv/" + String(month).padStart(2,'0') + String(date).padStart(2,'0') + ".csv"
    d3.csv(pastUrl,function(d) { return {year: d.YEAR, max: +d.MAX, min: +d.MIN}}).then(function(past) { 
      var maxTemps = past.map(function(d) { return parseFloat(d.max) })
      var minTemps = past.map(function(d) { return parseFloat(d.min) })

      // make histograms
      var highWeird = makeHist("graphWrapper", todayHigh, maxTemps, " highs in Chicago", "max", past)
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
  });   
})

// // Docs at http://simpleweatherjs.com
// $(document).ready(function() {
//   $.simpleWeather({
//     location: 'Chicago, IL',
//     woeid: '',
//     unit: 'f',
//     success: function(weather) {

//
//     },
//     error: function(error) {
//       $("#weather").html('<p>'+error+'</p>');
//     }
//   });
// });



// var past = gon.past //
// var past = d3.range(50).map(function(d) { return {
//   year: 1967 + d,
//   max: 32 + 1.8 * (d3.random.bates(10)() * 21 + 20),
//   min: 32 + 1.8 * (d3.random.bates(10)() * 19 + 20)
// }});
// var maxTemps = d3.range(50).map(function() { return 32 + 1.8 * (d3.random.bates(10)() * 20 + 20) });
// var minTemps = d3.range(50).map(function() { return 32 + 1.8 * (d3.random.bates(10)() * 20 + 20) });
// var years = d3.range(50).map(function() { return })

data = 3

var makeHist = function(wrapperId, value, temps, title, key, past) {
    // A formatter for counts.
    var formatCount = d3.format(",.0f");

    var margin = {top: 60, right: 30, bottom: 30, left: 30},
        width = parseInt(d3.select("#" + wrapperId).style("width")) - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;
        
        
    var x_with_value = d3.scaleLinear()
        .domain([Math.floor(d3.extent(temps.concat(value))[0]), Math.ceil(d3.extent(temps.concat(value))[1])])
        .range([0, width]);

    // Generate a histogram using twenty uniformly-spaced bins.
    var tickNum = 15
    var data = d3.histogram()
        .value(function(d) {return d[key]})
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
        .attr("x1", x(value))
        .attr("y1", -10)
        .attr("x2", x(value))
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

    // data.forEach(function(d,i) {
    //     d = d.sort(function(e,f) { return f.year - e.year})
    //     d.forEach(function(j,k) {
    //         svg.append("text")
    //         .attr("dy", ".75em")
    //         .attr("y", 5 + y(d.length) + k * 10)
    //         .attr("x", x(d.x) + x(data[0].dx + x.domain()[0]) / 2)
    //         .attr("text-anchor", "middle")
    //         // .attr("fill", "white")
    //         // .attr("stroke", "white")
    //         .text(j.year);
    //     })
    // })

        

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
        .attr("x", x(value))
        .attr("text-anchor", "middle")
        .text("2018");

    svg.append("text")
        .attr("dy", "2em")
        .attr("y", -70)
        .attr("x", width/2)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .text(Date().substring(4,10) + title);
    
  return isweird(temps,value)
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
