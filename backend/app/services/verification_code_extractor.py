"""
智能验证码提取服务
Smart Verification Code Extraction Service
"""

import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class VerificationCodeResult:
    """验证码识别结果"""
    code: str
    confidence: float  # 置信度 0-1
    pattern_type: str  # 匹配的模式类型
    position: Tuple[int, int]  # 在原文中的位置
    context: str  # 上下文


class SmartVerificationCodeExtractor:
    """智能验证码提取器"""
    
    def __init__(self):
        # 🌍 国内短信验证码特征模式
        self.domestic_patterns = [
            # 中文验证码模式
            {
                'pattern': r'验证码[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'domestic_chinese_prefix',
                'confidence': 0.95,
                'description': '中文验证码前缀'
            },
            {
                'pattern': r'([A-Za-z0-9]{4,8})[^A-Za-z0-9]*验证码',
                'type': 'domestic_chinese_suffix',
                'confidence': 0.90,
                'description': '中文验证码后缀'
            },
            {
                'pattern': r'【.*?】.*?([A-Za-z0-9]{4,8})',
                'type': 'domestic_bracket_format',
                'confidence': 0.85,
                'description': '中文方括号格式'
            },
            {
                'pattern': r'动态码[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'domestic_dynamic_code',
                'confidence': 0.90,
                'description': '动态码'
            },
            {
                'pattern': r'短信验证码[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'domestic_sms_code',
                'confidence': 0.95,
                'description': '短信验证码'
            },
            {
                'pattern': r'登录验证码[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'domestic_login_code',
                'confidence': 0.90,
                'description': '登录验证码'
            },
            {
                'pattern': r'安全码[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'domestic_security_code',
                'confidence': 0.85,
                'description': '安全码'
            }
        ]
        
        # 🌏 国外短信验证码特征模式
        self.international_patterns = [
            # 英文验证码模式
            {
                'pattern': r'verification code[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'international_verification_code',
                'confidence': 0.95,
                'description': '英文验证码'
            },
            {
                'pattern': r'code[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'international_code',
                'confidence': 0.80,
                'description': '英文code'
            },
            {
                'pattern': r'OTP[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'international_otp',
                'confidence': 0.90,
                'description': 'OTP一次性密码'
            },
            {
                'pattern': r'PIN[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'international_pin',
                'confidence': 0.85,
                'description': 'PIN码'
            },
            {
                'pattern': r'security code[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'international_security_code',
                'confidence': 0.90,
                'description': '英文安全码'
            },
            {
                'pattern': r'login code[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'international_login_code',
                'confidence': 0.85,
                'description': '英文登录码'
            },
            {
                'pattern': r'access code[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'international_access_code',
                'confidence': 0.85,
                'description': '英文访问码'
            },
            {
                'pattern': r'confirm code[：:\s]*([A-Za-z0-9]{4,8})',
                'type': 'international_confirm_code',
                'confidence': 0.85,
                'description': '英文确认码'
            }
        ]
        
        # 🔢 通用数字模式（较低置信度）
        self.generic_patterns = [
            {
                'pattern': r'\b(\d{6})\b',
                'type': 'generic_6_digits',
                'confidence': 0.70,
                'description': '6位纯数字'
            },
            {
                'pattern': r'\b(\d{4})\b',
                'type': 'generic_4_digits',
                'confidence': 0.60,
                'description': '4位纯数字'
            },
            {
                'pattern': r'\b(\d{5})\b',
                'type': 'generic_5_digits',
                'confidence': 0.65,
                'description': '5位纯数字'
            },
            {
                'pattern': r'\b(\d{8})\b',
                'type': 'generic_8_digits',
                'confidence': 0.60,
                'description': '8位纯数字'
            },
            {
                'pattern': r'\b([A-Za-z0-9]{6})\b',
                'type': 'generic_6_alphanumeric',
                'confidence': 0.50,
                'description': '6位字母数字组合'
            },
            {
                'pattern': r'\b([A-Z]{4,6})\b',
                'type': 'generic_uppercase_letters',
                'confidence': 0.40,
                'description': '4-6位大写字母'
            }
        ]
        
        # 🚫 排除模式（避免误识别）
        self.exclusion_patterns = [
            r'\b(1000|2000|3000|4000|5000|6000|7000|8000|9000)\b',  # 整千数字
            r'\b(2024|2023|2022|2021|2020)\b',  # 年份
            r'\b(0000|1111|2222|3333|4444|5555|6666|7777|8888|9999)\b',  # 重复数字
            r'\b(1234|4321|0123|9876)\b',  # 连续数字
            r'\b(http|https|www|com|org|net)\b',  # 网址相关
            r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b',  # IP地址
        ]
    
    def detect_sms_region(self, sender: str, content: str) -> str:
        """
        检测短信来源地区
        Detect SMS region (domestic/international)
        """
        # 发送方号码特征判断
        if sender:
            # 中国大陆号码特征
            if (sender.startswith('+86') or 
                sender.startswith('86') or 
                re.match(r'^1[3-9]\d{9}$', sender) or
                len(sender) == 11 and sender.isdigit()):
                return 'domestic'
            
            # 国际号码特征
            if sender.startswith('+') and not sender.startswith('+86'):
                return 'international'
        
        # 内容语言特征判断
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', content))
        english_words = len(re.findall(r'\b[A-Za-z]+\b', content))
        
        if chinese_chars > english_words:
            return 'domestic'
        elif english_words > chinese_chars and english_words > 3:
            return 'international'
        
        return 'unknown'
    
    def is_excluded_code(self, code: str) -> bool:
        """检查是否为排除的代码"""
        for pattern in self.exclusion_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return True
        return False
    
    def extract_verification_codes(self, content: str, sender: str = "") -> List[VerificationCodeResult]:
        """
        智能提取验证码
        Smart verification code extraction
        """
        results = []
        region = self.detect_sms_region(sender, content)
        
        logger.info(f"🔍 验证码提取开始: 发送方={sender}, 地区={region}, 内容长度={len(content)}")
        
        # 根据地区选择优先模式
        if region == 'domestic':
            pattern_groups = [self.domestic_patterns, self.international_patterns, self.generic_patterns]
            logger.info("🇨🇳 使用国内短信模式优先")
        elif region == 'international':
            pattern_groups = [self.international_patterns, self.domestic_patterns, self.generic_patterns]
            logger.info("🌍 使用国际短信模式优先")
        else:
            pattern_groups = [self.domestic_patterns, self.international_patterns, self.generic_patterns]
            logger.info("❓ 地区未知，使用混合模式")
        
        # 按优先级顺序匹配
        for pattern_group in pattern_groups:
            for pattern_info in pattern_group:
                pattern = pattern_info['pattern']
                matches = re.finditer(pattern, content, re.IGNORECASE)
                
                for match in matches:
                    code = match.group(1)
                    
                    # 排除不合理的代码
                    if self.is_excluded_code(code):
                        logger.debug(f"❌ 排除代码: {code} (匹配排除模式)")
                        continue
                    
                    # 检查是否已经找到相同的代码
                    if any(r.code == code for r in results):
                        continue
                    
                    result = VerificationCodeResult(
                        code=code,
                        confidence=pattern_info['confidence'],
                        pattern_type=pattern_info['type'],
                        position=match.span(),
                        context=self._get_context(content, match.span(), 20)
                    )
                    
                    results.append(result)
                    logger.info(f"✅ 找到验证码: {code} (类型={pattern_info['type']}, 置信度={pattern_info['confidence']:.2f})")
        
        # 按置信度排序
        results.sort(key=lambda x: x.confidence, reverse=True)
        
        logger.info(f"🎯 验证码提取完成: 共找到 {len(results)} 个候选验证码")
        return results
    
    def _get_context(self, content: str, position: Tuple[int, int], context_length: int = 20) -> str:
        """获取验证码的上下文"""
        start, end = position
        context_start = max(0, start - context_length)
        context_end = min(len(content), end + context_length)
        
        context = content[context_start:context_end]
        # 在验证码位置添加标记
        relative_start = start - context_start
        relative_end = end - context_start
        
        return (context[:relative_start] + 
                "【" + context[relative_start:relative_end] + "】" + 
                context[relative_end:])
    
    def get_best_verification_code(self, content: str, sender: str = "") -> Optional[VerificationCodeResult]:
        """获取最佳验证码（置信度最高的）"""
        results = self.extract_verification_codes(content, sender)
        return results[0] if results else None
    
    def get_all_possible_codes(self, content: str, sender: str = "") -> Dict:
        """获取所有可能的验证码，按置信度分组"""
        results = self.extract_verification_codes(content, sender)
        
        return {
            'high_confidence': [r for r in results if r.confidence >= 0.8],
            'medium_confidence': [r for r in results if 0.6 <= r.confidence < 0.8],
            'low_confidence': [r for r in results if r.confidence < 0.6],
            'best_match': results[0] if results else None,
            'region': self.detect_sms_region(sender, content)
        }


# 全局实例
verification_extractor = SmartVerificationCodeExtractor()
