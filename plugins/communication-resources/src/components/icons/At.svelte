<!--
// Copyright © 2025 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
-->
<script lang="ts">
  export let size: 'small' | 'medium' | 'large'
  export let fill: string = 'currentColor'
</script>

<svg class="svg-{size}" {fill} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
  <path
    d="M18,10c0-1.7-0.5-3.3-1.5-4.7c-1-1.4-2.3-2.4-3.9-2.9C11,1.9,9.3,1.9,7.7,2.3c-1.6,0.5-3,1.5-4,2.8C2.6,6.5,2.1,8.1,2,9.7c-0.1,1.7,0.4,3.3,1.3,4.7c0.9,1.4,2.3,2.5,3.8,3C8.1,17.8,9,18,10,18c0.7,0,1.4-0.1,2.1-0.3c0.3-0.1,0.4-0.3,0.4-0.6c-0.1-0.3-0.3-0.4-0.6-0.4c-1.4,0.4-2.9,0.3-4.3-0.2C6.2,16,5,15.1,4.2,13.9C3.4,12.7,3,11.2,3,9.8c0-1.5,0.5-2.9,1.4-4c0.9-1.2,2.1-2,3.5-2.4c1.4-0.4,2.9-0.4,4.3,0.1c1.4,0.5,2.6,1.4,3.4,2.6C16.5,7.1,17,8.5,17,10c0,0,0,0,0,0v1.2c0,0.9-0.7,1.6-1.6,1.6s-1.6-0.7-1.6-1.6V10c0,0,0,0,0,0s0,0,0,0V7.5c0-0.3-0.2-0.5-0.5-0.5c-0.3,0-0.5,0.2-0.5,0.5c-0.7-0.8-1.7-1.3-2.8-1.3c-2.1,0-3.8,1.7-3.8,3.8c0,2.1,1.7,3.8,3.8,3.8c1.3,0,2.4-0.6,3.1-1.5c0.4,0.9,1.3,1.5,2.4,1.5c1.4,0,2.6-1.2,2.6-2.6L18,10C18,10,18,10,18,10z M10,12.8c-1.6,0-2.8-1.3-2.8-2.8S8.4,7.2,10,7.2c1.6,0,2.8,1.3,2.8,2.8v0C12.8,11.6,11.6,12.8,10,12.8z"
  />
</svg>
