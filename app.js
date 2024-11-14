const apiKey = "59a1f2da9848aa5e2b8211efec8ef850";
const userLocationContainer = document.getElementById("user-location-weather");
const userLocationLoader = document.getElementById("user-location-loader");

const weatherContainer = document.getElementById("weather-container");
const cityInput = document.getElementById("city-input");
const autocompleteList = document.getElementById("autocomplete-list");
const maxCities = 5; // Максимальная цифра городов в избранном
let cityCount = 0; // Лічильник міст
const favoritesTab = document.getElementById("favorites-tab");
const favoritesContainer = document.getElementById("favorites-container");

// Модальное окно для предупреждения о лимите
const modal = document.createElement("div");
modal.id = "confirmation-modal";
modal.style.display = "none"; // Скрыто по умолчанию
modal.innerHTML = `
  <div class="modal-content">
    <p>Вы можете добавить только 5 городов. Удалите один, чтобы добавить новый.</p>
    <button id="close-modal-btn">Закрыть</button>
  </div>
`;
document.body.appendChild(modal);

// Функция для получения местоположения пользователя
async function fetchUserLocationWeather() {
  userLocationLoader.style.display = "block"; // Показываем прелоадер

  try {
    const response = await fetch("https://ipinfo.io/json?token=73bb8d6c8f64a7");
    const locationData = await response.json();
    const city = locationData.city;

    if (city) {
      // Получаем погоду для города пользователя
      fetchWeatherData(city, true);
      cityInput.value = ""; // Очистка инпута после определения местоположения
    } else {
      alert("Не удалось определить ваше местоположение.");
    }
  } catch (error) {
    console.error("Ошибка при получении местоположения:", error);
  } finally {
    userLocationLoader.style.display = "none"; // Скрываем прелоадер
  }
}

// Функция для поиска городов
async function searchCities(query) {
  if (query.length < 3) {
    autocompleteList.innerHTML = "";
    return;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/find?q=${query}&appid=${apiKey}&units=metric&lang=uk`
    );
    const data = await response.json();

    if (data.list && data.list.length > 0) {
      autocompleteList.innerHTML = "";
      data.list.forEach((city) => {
        const listItem = document.createElement("li");
        listItem.textContent = `${city.name}, ${city.sys.country}`;
        listItem.addEventListener("click", () => {
          cityInput.value = listItem.textContent;
          autocompleteList.innerHTML = "";
          fetchWeatherData(city.name); // Получаем данные о погоде
          cityInput.value = ""; // Очистка инпута после выбора города
        });
        autocompleteList.appendChild(listItem);
      });
    } else {
      autocompleteList.innerHTML = "<li>Місто не знайдено</li>";
    }
  } catch (error) {
    console.error("Ошибка при поиске городов:", error);
  }
}

// Функция для загрузки данных о погоде
async function fetchWeatherData(city, isUserCity = false) {
  if (cityCount >= maxCities && !isUserCity) {
    modal.style.display = "flex"; // Показываем модальное окно при превышении лимита
    return;
  }

  try {
    const currentWeatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=uk`
    );
    const currentWeatherData = await currentWeatherResponse.json();

    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric&lang=uk`
    );
    const forecastData = await forecastResponse.json();

    if (currentWeatherData.cod === 200 && forecastData.cod === "200") {
      renderWeatherCard(currentWeatherData, forecastData, isUserCity);
      if (!isUserCity) {
        cityInput.value = ""; // Очистка инпута после загрузки погоды для выбранного города
      }
    } else {
      alert("Не вдалося знайти місто!");
    }
  } catch (error) {
    console.error("Ошибка при загрузке данных о погоде:", error);
  }
}

// Функция для отображения карточки погоды
function renderWeatherCard(currentData, forecastData, isUserCity) {
  const card = document.createElement("div");
  card.classList.add("weather-card");

  const city = currentData.name;
  const temperature = currentData.main.temp;
  const description = currentData.weather[0].description;
  const humidity = currentData.main.humidity;
  const windSpeed = currentData.wind.speed;

  // График температуры по часам
  const temperatureData = forecastData.list.map((item) => item.main.temp);
  const labels = forecastData.list.map((item) =>
    new Date(item.dt * 1000).getHours()
  );

  // Данные для прогноза по дням (средняя температура по дням)
  const dailyData = [];
  const dailyLabels = [];

  for (let i = 0; i < forecastData.list.length; i += 8) {
    const dayData = forecastData.list[i];
    const date = new Date(dayData.dt * 1000);
    const day = date.toLocaleDateString(); // Группируем по дате
    const temp = dayData.main.temp;

    // Группируем температуру по дням
    if (!dailyData[day]) {
      dailyData[day] = [];
    }
    dailyData[day].push(temp);
  }

  // Средняя температура за день
  for (const day in dailyData) {
    const temps = dailyData[day];
    const averageTemp =
      temps.reduce((sum, temp) => sum + temp, 0) / temps.length;
    dailyLabels.push(day);
    dailyData.push(averageTemp);
  }

  // HTML структура карточки
  card.innerHTML = `
    <h3>${city}</h3>
    <p>Температура: ${temperature}°C</p>
    <p>${description}</p>
    <p>Вологість: ${humidity}%</p>
    <p>Швидкість вітру: ${windSpeed} м/с</p>
    <button class="remove-btn">Видалити</button>
    <button class="favorite-btn">Додати до вибраного</button>
    <div class="chart-container">
      <canvas id="temperature-chart-${city}"></canvas>
    </div>
    <button class="toggle-view-btn">День/Тиждень</button>
  `;

  // График температуры по часам
  const ctx = card.querySelector(`#temperature-chart-${city}`).getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Температура (°C)",
          data: temperatureData,
          borderColor: "rgba(75, 192, 192, 1)",
          fill: false,
        },
      ],
    },
  });

  // Обработчик кнопки удаления
  card.querySelector(".remove-btn").addEventListener("click", () => {
    card.remove();
    cityCount--;
    removeFromFavorites(city); // Удаляем из избранного
  });

  // Обработчик кнопки добавления в избранное
  const favoriteBtn = card.querySelector(".favorite-btn");
  favoriteBtn.addEventListener("click", () => {
    addToFavorites(city);
    card.classList.add("favorite"); // Добавляем класс для визуального выделения
    cityInput.value = ""; // Очистка инпута после добавления города в избранное
  });

  // Обработчик переключения между день/неделя
  const toggleViewBtn = card.querySelector(".toggle-view-btn");
  toggleViewBtn.addEventListener("click", () => {
    toggleForecastView(chart, labels, temperatureData, dailyLabels, dailyData);
  });

  if (isUserCity) {
    userLocationContainer.innerHTML = ""; // Очищаем блок перед добавлением данных
    userLocationContainer.appendChild(card); // Добавляем в отдельный блок для города пользователя
  } else {
    weatherContainer.appendChild(card);
    cityCount++;
  }
}

// Функция для добавления города в избранное
function addToFavorites(city) {
  const favorites = JSON.parse(localStorage.getItem("favorites")) || [];

  // Если город еще не в избранном, добавляем его
  if (favorites.length < maxCities) {
    if (!favorites.includes(city)) {
      favorites.push(city);
      localStorage.setItem("favorites", JSON.stringify(favorites));
      renderFavorites(); // Обновляем вкладку избранного
    }
  } else {
    modal.style.display = "flex"; // Если лимит превышен, показываем модальное окно
  }
}

// Функция для удаления города из избранного
function removeFromFavorites(city) {
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favorites = favorites.filter((item) => item !== city);
  localStorage.setItem("favorites", JSON.stringify(favorites));
  renderFavorites(); // Обновляем вкладку избранного
}

// Функция для отображения избранных городов
function renderFavorites() {
  const favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favoritesContainer.innerHTML = ""; // Очищаем вкладку

  favorites.forEach((city) => {
    const card = document.createElement("div");
    card.classList.add("weather-card");
    card.innerHTML = `
      <h3>${city}</h3>
      <button class="remove-btn">Видалити</button>
      <button class="toggle-view-btn">День/Тиждень</button>
    `;

    const removeBtn = card.querySelector(".remove-btn");
    removeBtn.addEventListener("click", () => removeFromFavorites(city));

    const toggleBtn = card.querySelector(".toggle-view-btn");
    toggleBtn.addEventListener("click", () => toggleForecastView(city));

    favoritesContainer.appendChild(card);
  });
}

// Функция для переключения между день/неделя
function toggleForecastView(
  chart,
  labels,
  temperatureData,
  dailyLabels,
  dailyData
) {
  chart.data.labels =
    chart.data.labels.length === labels.length ? dailyLabels : labels;
  chart.data.datasets[0].data =
    chart.data.labels.length === labels.length ? dailyData : temperatureData;
  chart.update();
}

// Слушатель событий для поля ввода города
cityInput.addEventListener("input", () => {
  const query = cityInput.value;
  searchCities(query);
});

// Слушатель для закрытия модального окна
document.getElementById("close-modal-btn").addEventListener("click", () => {
  modal.style.display = "none";
});

// Загружаем избранные города при старте
renderFavorites();
fetchUserLocationWeather(); // Загружаем погоду для города пользователя

// Функция закрытия модального окна
document.addEventListener("click", (event) => {
  // Закрытие модального окна, если нажали на кнопку закрытия
  if (event.target.id === "close-modal-btn") {
    modal.style.display = "none";
  }
});
