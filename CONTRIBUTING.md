# 🤝 贡献指南

感谢您对SMS转发管理系统的关注！我们欢迎所有形式的贡献，包括但不限于：

- 🐛 报告Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码修复
- ⚡ 性能优化
- 🌐 多语言支持

## 📋 贡献方式

### 🐛 报告问题

如果您发现了Bug或有改进建议，请：

1. **搜索现有Issues** - 确保问题尚未被报告
2. **创建新Issue** - 使用合适的Issue模板
3. **提供详细信息** - 包括复现步骤、环境信息、错误日志等

#### Bug报告模板

```markdown
**Bug描述**
简洁清晰地描述Bug

**复现步骤**
1. 进入 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

**预期行为**
描述您期望发生的情况

**实际行为**
描述实际发生的情况

**环境信息**
- 操作系统: [例如 Windows 11]
- 浏览器: [例如 Chrome 120]
- 项目版本: [例如 v1.0.0]

**截图**
如果适用，添加截图来帮助解释问题

**附加信息**
添加任何其他相关信息
```

### 💡 功能建议

提出新功能建议时，请：

1. **描述问题** - 解释当前的限制或需求
2. **提出解决方案** - 详细描述您建议的功能
3. **考虑替代方案** - 列出其他可能的解决方案
4. **评估影响** - 考虑对现有功能的影响

### 🔧 代码贡献

#### 开发环境设置

1. **Fork项目**
   ```bash
   # 在GitHub上Fork项目到您的账号
   ```

2. **克隆仓库**
   ```bash
   git clone https://github.com/YOUR_USERNAME/SMS-forwarding.git
   cd SMS-forwarding
   ```

3. **设置开发环境**
   ```bash
   # 后端环境
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # 前端环境
   cd ../frontend
   npm install
   
   # 客户端环境
   cd ../customer-site
   npm install
   ```

4. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

#### 代码规范

##### Python代码规范

- 遵循 [PEP 8](https://www.python.org/dev/peps/pep-0008/) 规范
- 使用类型提示 (Type Hints)
- 编写文档字符串 (Docstrings)
- 使用有意义的变量和函数名

```python
from typing import List, Optional
from pydantic import BaseModel

class SmsMessage(BaseModel):
    """短信消息模型
    
    Attributes:
        id: 消息唯一标识
        content: 短信内容
        sender: 发送方号码
        received_at: 接收时间
    """
    id: int
    content: str
    sender: str
    received_at: datetime
    
    def extract_verification_code(self) -> Optional[str]:
        """提取验证码
        
        Returns:
            验证码字符串，如果未找到则返回None
        """
        # 实现逻辑...
        pass
```

##### TypeScript/React代码规范

- 使用TypeScript严格模式
- 遵循React Hooks最佳实践
- 使用函数式组件
- 编写PropTypes或TypeScript接口

```typescript
interface SmsListProps {
  messages: SmsMessage[];
  onMessageSelect: (message: SmsMessage) => void;
  loading?: boolean;
}

const SmsList: React.FC<SmsListProps> = ({ 
  messages, 
  onMessageSelect, 
  loading = false 
}) => {
  // 组件实现...
};
```

##### 提交信息规范

使用 [约定式提交](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 格式：

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

**类型说明：**
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例：**
```
feat(sms): 添加验证码自动提取功能

- 支持多种验证码格式识别
- 添加正则表达式配置
- 优化提取算法性能

Closes #123
```

#### 测试要求

##### 后端测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_sms_service.py

# 生成覆盖率报告
pytest --cov=app tests/
```

##### 前端测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率
npm run test:coverage
```

#### Pull Request流程

1. **确保代码质量**
   - 所有测试通过
   - 代码符合规范
   - 没有明显的性能问题

2. **更新文档**
   - 更新相关的README或文档
   - 添加必要的代码注释
   - 更新API文档（如果适用）

3. **创建Pull Request**
   - 使用清晰的标题和描述
   - 引用相关的Issue
   - 添加截图或演示（如果适用）

4. **响应Review**
   - 及时回应审查意见
   - 进行必要的修改
   - 保持友好的沟通

#### Pull Request模板

```markdown
## 📝 变更描述
简要描述此PR的变更内容

## 🔗 相关Issue
Closes #(issue编号)

## 📋 变更类型
- [ ] Bug修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 性能优化
- [ ] 代码重构

## 🧪 测试
- [ ] 已添加测试用例
- [ ] 所有测试通过
- [ ] 手动测试通过

## 📸 截图/演示
如果适用，添加截图或GIF演示

## ✅ 检查清单
- [ ] 代码符合项目规范
- [ ] 已更新相关文档
- [ ] 已添加必要的测试
- [ ] 提交信息符合规范
```

## 🎯 开发指南

### 项目架构

```
SMS-forwarding/
├── backend/           # FastAPI后端
│   ├── app/
│   │   ├── api/       # API路由
│   │   ├── models/    # 数据模型
│   │   ├── services/  # 业务逻辑
│   │   └── utils/     # 工具函数
├── frontend/          # React管理端
├── customer-site/     # React客户端
└── docs/             # 项目文档
```

### 开发工作流

1. **选择Issue** - 从Issue列表中选择要处理的问题
2. **创建分支** - 基于main分支创建功能分支
3. **开发功能** - 编写代码并进行测试
4. **提交代码** - 使用规范的提交信息
5. **创建PR** - 提交Pull Request并等待审查
6. **合并代码** - 审查通过后合并到main分支

### 调试技巧

#### 后端调试

```python
# 使用logging进行调试
import logging
logger = logging.getLogger(__name__)

def process_sms(message: str):
    logger.debug(f"Processing message: {message}")
    # 处理逻辑...
```

#### 前端调试

```typescript
// 使用console进行调试
console.log('SMS data:', smsData);

// 使用React DevTools
// 安装浏览器扩展进行组件调试
```

### 性能优化

#### 后端优化

- 使用数据库索引优化查询
- 实现适当的缓存策略
- 使用异步处理提高并发性能

#### 前端优化

- 使用React.memo避免不必要的重渲染
- 实现虚拟滚动处理大量数据
- 使用懒加载优化初始加载时间

## 🌟 贡献者认可

我们会在以下地方认可贡献者：

- **README.md** - 贡献者列表
- **CHANGELOG.md** - 版本更新记录
- **GitHub Releases** - 发布说明
- **项目网站** - 贡献者页面（如果有）

## 📞 获取帮助

如果您在贡献过程中遇到问题：

1. **查看文档** - 阅读README和相关文档
2. **搜索Issues** - 查看是否有类似问题
3. **提问讨论** - 在GitHub Discussions中提问
4. **联系维护者** - 通过Issue或邮件联系

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！您的每一个贡献都让这个项目变得更好。

---

**记住：没有贡献太小，没有贡献者不重要！**
