<template>
    <base-stamped-element :title="title" :help-text="helpText" />
</template>

<script>
import Vue from "vue"
import "streams/app/components/stamped_elements/BaseStampedElement.vue"


export default Vue.component("followed-stamped-element", {
    computed: {
        title() {
            return gettext("Followed")
        },
        helpText() {
            return gettext("Content from followed users.")
        },
    },
})
</script>
