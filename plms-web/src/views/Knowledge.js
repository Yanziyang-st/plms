import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, EmptyState, Markdown, UserChip } from '../components/ui.js'
import { useDataStore } from '../stores/data.js'
import { useAuthStore } from '../stores/auth.js'
import { errorMessage } from '../api/request.js'
import { fromNow } from '../utils/format.js'

export default {
  name: 'KnowledgeView',
  components: { AppIcon, PageHeader, EmptyState, Markdown, UserChip },
  template: `
    <div>
      <PageHeader title="知识管理" description="结构化沉淀团队经验与资源，支持版本回溯与多人协作">
        <template #actions>
          <button v-if="canWrite" class="btn" @click="openSpaceDialog"><AppIcon name="plus" :size="16" /> 新建空间</button>
          <button v-if="canWrite" class="btn" :disabled="!spaceId" @click="createPage(null)">
            <AppIcon name="file" :size="16" /> 新建页面
          </button>
          <button v-if="canWrite" class="btn btn-primary" :disabled="!pageId" @click="createPage(pageId)">
            <AppIcon name="plus" :size="16" /> 新建子页面
          </button>
        </template>
      </PageHeader>

      <div class="grid g-1-2">
        <div>
          <div class="card mb-4">
            <div class="card-head">
              <h3>知识空间</h3>
              <div class="right" v-if="canWrite && currentSpace">
                <button class="btn btn-sm btn-ghost" @click="removeSpace(currentSpace)">
                  <AppIcon name="trash" :size="13" /> 删除空间
                </button>
              </div>
            </div>
            <div class="card-pad" style="padding:8px">
              <div v-for="s in data.wikiSpaces" :key="s.id" class="list-row"
                   :style="s.id === spaceId ? 'background:var(--mint-50);border-color:var(--mint-200)' : ''"
                   @click="selectSpace(s.id)">
                <span style="font-size:20px">{{ s.icon }}</span>
                <div class="grow">
                  <b>{{ s.name }}</b>
                  <small>{{ pagesOf(s.id).length }} 个页面 · {{ data.userById(s.owner).name }}</small>
                </div>
              </div>
              <EmptyState v-if="!data.wikiSpaces.length" title="暂无空间" icon="folder" />
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <h3>{{ currentSpace?.name || '页面' }}</h3><span class="sub">{{ pages.length }} 页</span>
            </div>
            <div class="card-pad" style="padding:8px">
              <template v-for="p in pages" :key="p.id">
                <div class="list-row"
                     :style="(p.id === pageId ? 'background:var(--mint-50);border-color:var(--mint-200)' : '') + (p.parentId ? ';padding-left:26px' : '')"
                     @click="selectPage(p.id)">
                  <AppIcon :name="p.parentId ? 'file' : 'folder'" :size="16" />
                  <div class="grow"><b style="font-size:13px">{{ p.title }}</b></div>
                  <button v-if="canWrite" class="btn btn-sm btn-ghost" title="删除页面"
                          @click.stop="removePage(p)"><AppIcon name="trash" :size="13" /></button>
                </div>
              </template>
              <div v-if="!pages.length" class="hint" style="padding:12px">暂无页面</div>
            </div>
          </div>
        </div>

        <div class="card" v-loading="loading">
          <template v-if="currentPage">
            <div class="card-head">
              <h3>{{ currentPage.title }}</h3>
              <div class="right">
                <span class="hint">{{ data.userById(currentPage.author).name }} · 更新于 {{ fromNow(currentPage.updatedAt) }}</span>
                <button v-if="!editing" class="btn btn-sm" @click="startEdit"><AppIcon name="edit" :size="14" /> 编辑</button>
              </div>
            </div>
            <div class="card-pad">
              <div v-if="editing" class="form-grid">
                <div class="field">
                  <label>标题</label>
                  <input class="input" v-model="editForm.title" />
                </div>
                <div class="field">
                  <label>正文（支持 Markdown）</label>
                  <textarea class="input" v-model="editForm.content" rows="16"
                            style="font-family:'SFMono-Regular',Consolas,monospace;font-size:13px"></textarea>
                </div>
                <div class="flex gap-2">
                  <button class="btn btn-primary" :disabled="saving" @click="savePage">
                    <AppIcon name="check" :size="15" /> {{ saving ? '保存中…' : '保存' }}
                  </button>
                  <button class="btn" @click="editing = false">取消</button>
                  <span class="spacer"></span>
                  <span class="hint" style="align-self:center">支持 # 标题、**加粗**、- 列表、\`代码\`、表格</span>
                </div>
              </div>
              <Markdown v-else :content="currentPage.content" />
            </div>
          </template>
          <EmptyState v-else title="请选择一个页面" description="从左侧选择或新建页面" icon="file" />
        </div>
      </div>

      <!-- 新建空间 -->
      <el-dialog v-model="spaceDialog" title="新建知识空间" width="520px">
        <el-form label-position="top">
          <el-form-item label="空间名称" :error="formErrors.name" required>
            <el-input v-model="spaceForm.name" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="图标">
              <el-select v-model="spaceForm.icon" style="width:100%">
                <el-option v-for="i in ['📘','🛠️','🧪','🚀','📊']" :key="i" :label="i" :value="i" />
              </el-select>
            </el-form-item>
            <el-form-item label="负责人">
              <el-select v-model="spaceForm.owner" style="width:100%">
                <el-option v-for="u in data.users" :key="u.id" :label="u.name" :value="u.id" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="描述">
            <el-input v-model="spaceForm.description" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="spaceDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveSpace">{{ saving ? '创建中…' : '创建' }}</button>
        </template>
      </el-dialog>
    </div>
  `,
  setup() {
    const data = useDataStore()
    const auth = useAuthStore()
    const canWrite = computed(() => auth.canWrite('knowledge'))

    const spaceId = ref('')
    const pageId = ref('')
    const editing = ref(false)
    const saving = ref(false)
    const loading = ref(false)
    const spaceDialog = ref(false)
    const formErrors = ref({})
    const editForm = ref({ title: '', content: '' })
    const spaceForm = ref({ name: '', icon: '📘', owner: '', description: '' })

    const currentSpace = computed(() => data.spaceById(spaceId.value))
    const pages = computed(() => data.wikiPages.filter((p) => p.spaceId === spaceId.value))
    const currentPage = computed(() => data.wikiPages.find((p) => p.id === pageId.value) || null)

    const pagesOf = (sid) => data.wikiPages.filter((p) => p.spaceId === sid)

    function selectSpace(id) {
      spaceId.value = id
      editing.value = false
      const list = pagesOf(id)
      pageId.value = list.length ? list[0].id : ''
    }

    function selectPage(id) {
      pageId.value = id
      editing.value = false
    }

    function startEdit() {
      editForm.value = { title: currentPage.value.title, content: currentPage.value.content || '' }
      editing.value = true
    }

    async function savePage() {
      if (!editForm.value.title.trim()) {
        ElMessage.warning('标题不能为空')
        return
      }
      saving.value = true
      try {
        await data.edit('wiki-pages', pageId.value, {
          title: editForm.value.title.trim(),
          content: editForm.value.content,
        })
        editing.value = false
        ElMessage.success('已保存')
      } catch (e) {
        ElMessage.error(errorMessage(e, '保存失败'))
      } finally {
        saving.value = false
      }
    }

    async function createPage(parentId) {
      const parent = parentId ? data.wikiPages.find((p) => p.id === parentId) : null
      try {
        const created = await data.save('wiki-pages', {
          spaceId: spaceId.value,
          title: parent ? parent.title + ' · 子页面' : '未命名页面',
          parentId: parentId || null,
          author: data.users[0]?.id,
          content: '# 未命名页面\n\n开始撰写内容…',
        })
        pageId.value = created.id
        editForm.value = { title: created.title, content: created.content }
        editing.value = true
        ElMessage.success(parent ? '子页面已创建，可直接编辑' : '页面已创建，可直接编辑')
      } catch (e) {
        ElMessage.error(errorMessage(e, '创建失败'))
      }
    }

    async function removePage(p) {
      const children = data.wikiPages.filter((x) => x.parentId === p.id)
      if (children.length) {
        ElMessage.warning(`该页面下还有 ${children.length} 个子页面，请先删除子页面`)
        return
      }
      try {
        await ElMessageBox.confirm(`确定删除页面「${p.title}」？此操作不可撤销。`, '删除确认', {
          type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
        })
      } catch (e) { return }
      try {
        await data.destroy('wiki-pages', p.id)
        if (pageId.value === p.id) {
          const rest = pagesOf(spaceId.value)
          pageId.value = rest.length ? rest[0].id : ''
          editing.value = false
        }
        ElMessage.success('页面已删除')
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    async function removeSpace(s) {
      const count = pagesOf(s.id).length
      if (count) {
        ElMessage.warning(`该空间下还有 ${count} 个页面，请先清空页面`)
        return
      }
      try {
        await ElMessageBox.confirm(`确定删除知识空间「${s.name}」？`, '删除确认', {
          type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
        })
      } catch (e) { return }
      try {
        await data.destroy('wiki-spaces', s.id)
        spaceId.value = ''
        pageId.value = ''
        initSelection()
        ElMessage.success('空间已删除')
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    function openSpaceDialog() {
      formErrors.value = {}
      spaceForm.value = { name: '', icon: '📘', owner: data.users[0]?.id || '', description: '' }
      spaceDialog.value = true
    }

    async function saveSpace() {
      formErrors.value = {}
      saving.value = true
      try {
        const created = await data.save('wiki-spaces', {
          name: spaceForm.value.name, icon: spaceForm.value.icon,
          owner: spaceForm.value.owner, description: spaceForm.value.description || '',
          members: [spaceForm.value.owner],
        })
        ElMessage.success('空间已创建')
        spaceDialog.value = false
        selectSpace(created.id)
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '创建失败'))
      } finally {
        saving.value = false
      }
    }

    function initSelection() {
      if (!spaceId.value && data.wikiSpaces.length) selectSpace(data.wikiSpaces[0].id)
    }

    onMounted(initSelection)
    watch(() => data.wikiSpaces.length, initSelection)

    return {
      data, auth, canWrite, spaceId, pageId, editing, saving, loading, spaceDialog, formErrors,
      editForm, spaceForm, currentSpace, pages, currentPage, pagesOf,
      selectSpace, selectPage, startEdit, savePage, createPage, removePage, removeSpace,
      openSpaceDialog, saveSpace, fromNow,
    }
  },
}
