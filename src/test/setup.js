import '@testing-library/jest-dom';

// antd's responsive observer calls window.matchMedia, which jsdom does not implement.
// Polyfill it so antd components (Form, Grid, etc.) can render under the test environment.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
