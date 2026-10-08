/**
 * 화면 모드(<html data-theme>)에 맞는 한 장만 보이는 이미지. 흰색 로고는 밝은 배경에서 묻히므로
 * 어두운 배경용(dark)과 밝은 배경용(light)을 따로 두고, 전환은 index.css의 logo-for-* 규칙이 한다.
 */
export default function ThemedImage({ dark, light, alt = '', className = '' }) {
  return (
    <>
      <img src={dark} alt={alt} className={`logo-for-dark ${className}`} />
      <img src={light} alt={alt} className={`logo-for-light ${className}`} />
    </>
  )
}
