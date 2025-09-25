class Settings(BaseSettings):
    """应用配置类"""
    
    # 应用基础配置
    app_name: str = "Mobile Information Management System"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # 数据库配置
    database_url: str = "postgresql://user:password@localhost:5432/xianyu_db"
    
    # 安全配置
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # 服务器配置 - 强制8000端口
    host: str = "0.0.0.0"
    port: int = 8000  # 强制8000端口，不从环境变量读取
    
    # 心跳配置
    heartbeat_interval: int = 10  # 秒
    offline_threshold: int = 30   # 秒
    
    # 验证码配置
    verification_code_interval: int = 10  # 秒
    max_verification_attempts: int = 5
    max_access_attempts: int = 5
    
    # CORS 配置
    allowed_origins_str: str = Field(default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001", alias="ALLOWED_ORIGINS")
    
    @property
    def allowed_origins(self) -> List[str]:
        """将逗号分隔的字符串转换为列表"""
        return [origin.strip() for origin in self.allowed_origins_str.split(",") if origin.strip()]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
