# Chapter 1

```argus
trait IntoString {
    fn to_string(&self) -> String;
}

impl IntoString for (i32, i32) {
    fn to_string(&self) -> String {
        String::from("(...)")
    }
}

impl<T: IntoString> IntoString for Vec<T> {
    fn to_string(&self) -> String {
        String::from("Vec<T>")
    }
}

impl<T: IntoString> IntoString for [T] {
    fn to_string(&self) -> String {
        String::from("[T]")
    }
}

fn main() { 
    fn is_into_string<T: IntoString>() {}
    is_into_string::<Vec<&str>>();
}
```