/** @type {import('tailwindcss').Config} */
// Rekonstruiert aus dem committeten app/tailwind.css (die ursprüngliche
// Config war nicht im Repo – ohne sie erzeugte `npm run build:css` ein
// leeres Stylesheet). Die GEA-Farbwerte entsprechen exakt den im alten
// Build enthaltenen RGB-Werten.
module.exports = {
    content: [
        './index.html',
        './app/*.{js,jsx}',
        './app/views/*.jsx',
    ],
    theme: {
        extend: {
            colors: {
                gea: {
                    50:  '#e0f2f2',
                    100: '#b3e0df',
                    200: '#80cccc',
                    300: '#4db8b7',
                    400: '#26a8a7',
                    500: '#007a7a',
                    600: '#006363',
                    700: '#004c4c',
                    800: '#003535',
                    900: '#001e1e',
                },
            },
        },
    },
    plugins: [],
};
