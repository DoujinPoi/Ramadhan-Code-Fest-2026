 document.addEventListener('DOMContentLoaded', function() {
 	// DOM Elements
 	const colorDisplay = document.getElementById('colorDisplay');
 	const hueSlider = document.getElementById('hueSlider');
 	const saturationSlider = document.getElementById('saturationSlider');
 	const lightnessSlider = document.getElementById('lightnessSlider');
 	const hueValue = document.getElementById('hueValue');
 	const saturationValue = document.getElementById('saturationValue');
 	const lightnessValue = document.getElementById('lightnessValue');
 	const hexValue = document.getElementById('hexValue');
 	const rgbValue = document.getElementById('rgbValue');
 	const hslValue = document.getElementById('hslValue');

 	// Current color values (default to light pink)
 	let hue = 351;
 	let saturation = 100;
 	let lightness = 85;

 	// Initialize the color picker
 	updateColor();
 	updateSliderBackgrounds();

 	// Event listeners for sliders
 	hueSlider.addEventListener('input', function() {
 		hue = this.value;
 		hueValue.textContent = `${hue}°`;
 		updateColor();
 		updateSliderBackgrounds();
 	});

 	saturationSlider.addEventListener('input', function() {
 		saturation = this.value;
 		saturationValue.textContent = `${saturation}%`;
 		updateColor();
 		updateSliderBackgrounds();
 	});

 	lightnessSlider.addEventListener('input', function() {
 		lightness = this.value;
 		lightnessValue.textContent = `${lightness}%`;
 		updateColor();
 		updateSliderBackgrounds();
 	});

 	// Update the color display and values
 	function updateColor() {
 		const hslColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
 		colorDisplay.style.backgroundColor = hslColor;

 		// Convert HSL to HEX and RGB
 		const hex = hslToHex(hue, saturation, lightness);
 		const rgb = hslToRgb(hue, saturation, lightness);

 		// Update displayed values
 		hexValue.textContent = `#${hex}`;
 		rgbValue.textContent = `rgb(${rgb.join(', ')})`;
 		hslValue.textContent = hslColor;
 	}

 	// Update slider backgrounds based on current values
 	function updateSliderBackgrounds() {
 		document.documentElement.style.setProperty('--hue', hue);
 		document.documentElement.style.setProperty('--saturation', `${saturation}%`);
 		document.documentElement.style.setProperty('--lightness', `${lightness}%`);

 		// Update saturation slider background
 		saturationSlider.style.background = `linear-gradient(to right, 
                    hsl(${hue}, 0%, ${lightness}%), 
                    hsl(${hue}, 100%, ${lightness}%)`;

 		// Update lightness slider background
 		lightnessSlider.style.background = `linear-gradient(to right, 
                    hsl(${hue}, ${saturation}%, 0%), 
                    hsl(${hue}, ${saturation}%, 50%), 
                    hsl(${hue}, ${saturation}%, 100%)`;
 	}

 	// Convert HSL to HEX
 	function hslToHex(h, s, l) {
 		const rgb = hslToRgb(h, s, l);
 		return rgb.map(x => {
 			const hex = x.toString(16);
 			return hex.length === 1 ? '0' + hex : hex;
 		}).join('');
 	}

 	// Convert HSL to RGB
 	function hslToRgb(h, s, l) {
 		s /= 100;
 		l /= 100;

 		const c = (1 - Math.abs(2 * l - 1)) * s;
 		const x = c * (1 - Math.abs((h / 60) % 2 - 1));
 		const m = l - c / 2;

 		let r, g, b;

 		if (h >= 0 && h < 60) {
 			[r, g, b] = [c, x, 0];
 		} else if (h >= 60 && h < 120) {
 			[r, g, b] = [x, c, 0];
 		} else if (h >= 120 && h < 180) {
 			[r, g, b] = [0, c, x];
 		} else if (h >= 180 && h < 240) {
 			[r, g, b] = [0, x, c];
 		} else if (h >= 240 && h < 300) {
 			[r, g, b] = [x, 0, c];
 		} else {
 			[r, g, b] = [c, 0, x];
 		}

 		return [
 			Math.round((r + m) * 255),
 			Math.round((g + m) * 255),
 			Math.round((b + m) * 255)
 		];
 	}

 	// Generate color grids for each group
 	function generateColorGroups() {
 		// Pink tones
 		const pinkTones = [
 			'#FFB6C1', '#FFC0CB', '#FFD1DC', '#FF69B4', '#FF1493',
 			'#DB7093', '#FF82AB', '#FF6EB4', '#EE82EE', '#D8BFD8'
 		];

 		// Blue tones
 		const blueTones = [
 			'#a2d9ff', '#87CEFA', '#ADD8E6', '#B0E0E6', '#1E90FF',
 			'#4169E1', '#4682B4', '#5F9EA0', '#6495ED', '#00BFFF'
 		];

 		// Green tones
 		const greenTones = [
 			'#98FB98', '#90EE90', '#8FBC8F', '#3CB371', '#2E8B57',
 			'#228B22', '#008000', '#006400', '#9ACD32', '#7CFC00'
 		];

 		// Warm tones
 		const warmTones = [
 			'#FFD700', '#FFA500', '#FF8C00', '#FF7F50', '#FF6347',
 			'#FF4500', '#FFA07A', '#FA8072', '#E9967A', '#F08080'
 		];

 		// Purple tones
 		const purpleTones = [
 			'#9370DB', '#8A2BE2', '#9932CC', '#9400D3', '#8B008B',
 			'#800080', '#BA55D3', '#DA70D6', '#D8BFD8', '#DDA0DD'
 		];

 		// Neutral tones
 		const neutralTones = [
 			'#708090', '#778899', '#BEBEBE', '#D3D3D3', '#A9A9A9',
 			'#696969', '#808080', '#2F4F4F', '#556B2F', '#6B8E23'
 		];

 		// Generate each group
 		generateColorGrid('pinkTones', pinkTones);
 		generateColorGrid('blueTones', blueTones);
 		generateColorGrid('greenTones', greenTones);
 		generateColorGrid('warmTones', warmTones);
 		generateColorGrid('purpleTones', purpleTones);
 		generateColorGrid('neutralTones', neutralTones);
 	}

 	// Generate a single color grid
 	function generateColorGrid(elementId, colors) {
 		const grid = document.getElementById(elementId);

 		colors.forEach(color => {
 			const colorCard = document.createElement('div');
 			colorCard.className = 'color-card';
 			colorCard.style.backgroundColor = color;
 			colorCard.setAttribute('data-hex', color);

 			colorCard.addEventListener('click', function() {
 				copyToClipboard(color);
 				this.classList.add('copied');
 				setTimeout(() => this.classList.remove('copied'), 1500);

 				// Update picker with this color
 				const hsl = hexToHsl(color);
 				hue = hsl.h;
 				saturation = hsl.s;
 				lightness = hsl.l;

 				hueSlider.value = hue;
 				saturationSlider.value = saturation;
 				lightnessSlider.value = lightness;

 				hueValue.textContent = `${hue}°`;
 				saturationValue.textContent = `${saturation}%`;
 				lightnessValue.textContent = `${lightness}%`;

 				updateColor();
 				updateSliderBackgrounds();
 			});

 			grid.appendChild(colorCard);
 		});
 	}

 	// Convert HEX to HSL
 	function hexToHsl(hex) {
 		// Remove # if present
 		hex = hex.replace('#', '');

 		// Parse r, g, b values
 		let r, g, b;

 		if (hex.length === 3) {
 			r = parseInt(hex[0] + hex[0], 16);
 			g = parseInt(hex[1] + hex[1], 16);
 			b = parseInt(hex[2] + hex[2], 16);
 		} else if (hex.length === 6) {
 			r = parseInt(hex.substring(0, 2), 16);
 			g = parseInt(hex.substring(2, 4), 16);
 			b = parseInt(hex.substring(4, 6), 16);
 		} else {
 			return {
 				h: 0,
 				s: 0,
 				l: 0
 			};
 		}

 		// Convert RGB to HSL
 		r /= 255;
 		g /= 255;
 		b /= 255;

 		const max = Math.max(r, g, b);
 		const min = Math.min(r, g, b);
 		let h, s, l = (max + min) / 2;

 		if (max === min) {
 			h = s = 0; // achromatic
 		} else {
 			const d = max - min;
 			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

 			switch (max) {
 				case r:
 					h = (g - b) / d + (g < b ? 6 : 0);
 					break;
 				case g:
 					h = (b - r) / d + 2;
 					break;
 				case b:
 					h = (r - g) / d + 4;
 					break;
 			}

 			h /= 6;
 		}

 		return {
 			h: Math.round(h * 360),
 			s: Math.round(s * 100),
 			l: Math.round(l * 100)
 		};
 	}

 	// Copy to clipboard function
 	function copyToClipboard(text) {
 		const textarea = document.createElement('textarea');
 		textarea.value = text;
 		document.body.appendChild(textarea);
 		textarea.select();
 		document.execCommand('copy');
 		document.body.removeChild(textarea);
 	}

 	// Add click event to code values
 	[hexValue, rgbValue, hslValue].forEach(element => {
 		element.addEventListener('click', function() {
 			copyToClipboard(this.textContent);
 			this.classList.add('copied');
 			setTimeout(() => this.classList.remove('copied'), 1500);
 		});
 	});

 	// Generate all color groups
 	generateColorGroups();
 });