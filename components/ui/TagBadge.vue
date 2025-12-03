<script lang="ts" setup>
interface Props {
	text: string;
	color: string;
}

const props = defineProps<Props>();

// Ensure color is valid hex, fallback to gray if invalid
const normalizedColor = props.color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(props.color)
	? props.color
	: '#6b7280';
</script>

<template>
	<span
		:style="{ backgroundColor: normalizedColor }"
		class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
	>
		{{ text }}
	</span>
</template>

