import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { init } from './lib/store';
import './styles.css';

init();
registerSW({ immediate: true });

const root = document.getElementById('app');
if (root) render(<App />, root);
