<template>

	<div class="sidebar-item">

		<sidebar-heading :name="panelName" title="Evaluator" />

		<edit-hint v-show="visible">
			<template v-slot:main>Who is the evaluator(s) and governors of the service?</template>
			<template v-slot:details></template>
		</edit-hint>

		<div class="sidebar-content" v-show="visible">

			<div class="form-group">
				<label class="form-label" for="label">Label</label>
				<input
					:value="evaluation.label"
					@input="updateEvaluation({ prop: 'label', value: $event.target.value })"
					class="form-input"
					id="label"
					maxlength="255"
				>
			</div>

			<div class="form-group">
				<label class="form-label" for="type">Type</label>
				<button-group :options="activityTypes" :value="evaluation.type" @change="updateEvaluation({ prop: 'type', value: arguments[0] })" />
			</div>

			<div class="form-group">
				<label class="form-label" for="colour">Colour</label>
				<colour-picker
					name="evaluation"
					:colours="filteredColours"
					:value="evaluation.colour"
					@change="updateEvaluation({ prop: 'colour', value: arguments[0] })"
				/>
			</div>

			<div class="form-group">
				<label class="form-label" for="url">Web address</label>
				<input
					:value="evaluation.url"
					@input="updateEvaluation({ prop: 'url', value: $event.target.value })"
					class="form-input"
					id="url"
					maxlength="255"
					placeholder="https://"
				>
			</div>

		</div>

		<div class="sidebar-footer" v-show="visible">
			<button
				type="button"
				class="btn btn-success"
				@click="next()"
			>Next</button>
		</div>

	</div>

</template>

<script>

import { mapState, mapGetters, mapMutations } from 'vuex';
import filteredColours from '../../../data/filteredColours.js';
import activityTypes from '../../../data/activityTypes.json';

export default {

	data() {
		return {
			panelName: 'evaluation',
			filteredColours: filteredColours,
			activityTypes: activityTypes,
		};
	},

	computed: {
		...mapState('app', {
			visible(state) {
				return state.editPanel == this.panelName
			},
		}),
		...mapGetters('project', ['evaluation']),
	},

	methods: {
		...mapMutations('project', [
			'updateEvaluation',
		]),
		next() {
			this.$store.dispatch('app/doEditNext', this.panelName);
		}
	}

}
</script>
