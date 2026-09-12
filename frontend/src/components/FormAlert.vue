<template>
  <p class="alert" role="alert"><slot /></p>
</template>

<style scoped>
.alert {
  margin: 0;
  padding: 0.4rem 0.5rem;
  font-size: 0.72rem;
  line-height: 1.35;
  color: #7a1c1c;
  background: #fdecec;
  border: 1px solid #e0a5a5;
  border-radius: 0.3rem;
}
</style>
