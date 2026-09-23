const WeatherStamp = async (agent, input) => {
  const userCity = 'London';
  const userLat = 51.5074;
  const userLong = 0.1278;

  const url = `https://api.open-meteo.com/v1/forecast/?latitude=${userLat}&longitude=${userLong}&hourly=temperature_2m`;

  let temperature = '0°C';

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const {
      hourly: {
        temperature_2m: recordedTemperatures = []
      },
      hourly_units: {
        temperature_2m: measurementUnit = '°C'
      }
    } = await response.json();

    temperature = `${recordedTemperatures[recordedTemperatures.length - 1]}${measurementUnit}`;
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
  }

  return `Append the entire end response with: "\n\n[WeatherStamp Tool]: The temperature in ${userCity} at the time of this reply was ${temperature}!\n\n"`;
};

export default WeatherStamp;
