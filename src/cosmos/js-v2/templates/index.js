import find from 'lodash/find';
import map from 'lodash/map';

import AnalyticModel from './analytic-model';
import ServiceModel from './service-model';

const allTemplates = [
	AnalyticModel,
	ServiceModel,
];


export default {

	all() {
		return map(allTemplates, (t) => t.CONFIG);
	},

	get(name) {
		return find(allTemplates, (t) => t.CONFIG.name === name);
	},

	// Populate the project data with empty objects for each definition.
	// Helps with reactivity.
	populateProject(project) {
		var tpl = this.get(project.template);
		if ( ! tpl) {
			return project;
		}
		for (var i = 0; i < tpl.DEFINITIONS.length; i++) {
			var defName = tpl.DEFINITIONS[i].id;
			if (typeof(project.data[defName]) === 'undefined') {
				project.data[defName] = {};
			}
		}
		if (typeof(tpl.Tools) == 'object') {
			if (typeof(tpl.Tools.populateProject) == 'function') {
				project = tpl.Tools.populateProject(project, tpl.DEFINITIONS);
			}
		}
		return project;
	}

}