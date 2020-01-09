import 'es6-promise/auto';

import Vue from 'vue';
import VueKonva from 'vue-konva';

import App from './App';
import i18n from './plugins/i18n';
import router from './plugins/router';
import api from './services/api';
import store from './store';

Vue.use(VueKonva);


new Vue({
	el: '#app',
	template: '<App/>',
	i18n,
	router,
	store,
	components: { App },
});
