import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { useAuthStore } from '../stores/auth.js'
import { useDataStore } from '../stores/data.js'
import { errorMessage } from '../api/request.js'

export default {
  name: 'LoginView',
  components: { AppIcon },
  template: `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">M</div>
        <div class="login-title">Mint PLM</div>
        <div class="login-sub">软件生命周期管理系统 · 请登录后继续</div>

        <form @submit.prevent="submit">
          <div class="field mb-3">
            <label>账号</label>
            <el-input
              v-model="form.username"
              size="large"
              placeholder="请输入登录账号"
              :disabled="loading"
              clearable
            >
              <template #prefix><AppIcon name="user" :size="16" /></template>
            </el-input>
          </div>

          <div class="field mb-4">
            <label>密码</label>
            <el-input
              v-model="form.password"
              type="password"
              size="large"
              placeholder="请输入密码"
              :disabled="loading"
              show-password
              @keyup.enter="submit"
            >
              <template #prefix><AppIcon name="lock" :size="16" /></template>
            </el-input>
          </div>

          <div v-if="errMsg" class="login-error">{{ errMsg }}</div>

          <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
            <AppIcon v-if="!loading" name="logout" :size="16" />
            {{ loading ? '登录中…' : '登 录' }}
          </button>
        </form>

        <div class="login-tip">
          <b>演示账号</b>（密码均为 <code>123456</code>）<br />
          管理员：<a href="#" @click.prevent="fill('demo_admin')">demo_admin</a> ·
          产品经理：<a href="#" @click.prevent="fill('lina')">lina</a> ·
          测试工程师：<a href="#" @click.prevent="fill('zhaomin')">zhaomin</a>
        </div>
      </div>
    </div>
  `,
  setup() {
    const auth = useAuthStore()
    const data = useDataStore()
    const router = useRouter()
    const route = useRoute()

    const form = ref({ username: 'demo_admin', password: '123456' })
    const loading = ref(false)
    const errMsg = ref('')

    function fill(u) {
      form.value.username = u
      form.value.password = '123456'
    }

    async function submit() {
      errMsg.value = ''
      if (!form.value.username.trim() || !form.value.password) {
        errMsg.value = '请输入账号和密码'
        return
      }
      loading.value = true
      try {
        const user = await auth.login(form.value.username.trim(), form.value.password)
        // 登录成功后立即水合首屏数据，避免进入页面后二次白屏
        try {
          await data.hydrate(true)
        } catch (e) {
          /* 水合失败交由布局页展示错误态与重试 */
        }
        ElMessage.success(`欢迎回来，${user.name}`)
        const redirect = route.query.redirect
        router.replace(typeof redirect === 'string' && redirect ? redirect : '/dashboard')
      } catch (e) {
        errMsg.value = errorMessage(e, '登录失败')
      } finally {
        loading.value = false
      }
    }

    return { form, loading, errMsg, submit, fill }
  },
}
