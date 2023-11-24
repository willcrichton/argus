import { SerializedTree } from "@argus/common/types";

export var testTree: SerializedTree[] = [{"root":0,"nodes":[{"type":"goal","data":"fn(Timer) {run_timer}: bevy_simplified::IntoSystemConfig::<_>"},{"type":"candidate","data":"anon-candidate"},{"type":"goal","data":"fn(Timer) {run_timer}: bevy_simplified::IntoSystem::<(), (), _>"},{"type":"candidate","data":"anon-candidate"},{"type":"goal","data":"fn(Timer) {run_timer}: bevy_simplified::ExclusiveSystemParamFunction::<_>"},{"type":"candidate","data":"anon-candidate"},{"type":"goal","data":"for<'a> fn(Timer) {run_timer}: std::ops::FnMut::<(&'a mut bevy_simplified::TheWorld,)>"},{"type":"candidate","data":"anon-candidate"},{"type":"goal","data":"for<'a> fn(Timer) {run_timer}: std::ops::FnMut::<(&'a mut bevy_simplified::TheWorld,)>"},{"type":"candidate","data":"anon-candidate"},{"type":"result","data":"No"},{"type":"candidate","data":"anon-candidate"},{"type":"goal","data":"fn(Timer) {run_timer}: bevy_simplified::SystemParamFunction::<_>"},{"type":"candidate","data":"anon-candidate"},{"type":"goal","data":"Timer: bevy_simplified::SystemParam"},{"type":"candidate","data":"anon-candidate"},{"type":"result","data":"No"},{"type":"goal","data":"fn(Timer) {run_timer}: std::ops::FnMut::<(Timer,)>"},{"type":"candidate","data":"anon-candidate"},{"type":"result","data":"Yes"}],"topology":{"children":{"5":[6],"13":[14,17],"17":[18],"12":[13],"3":[4],"6":[7],"8":[9],"18":[19],"0":[1],"11":[12],"7":[8],"15":[16],"2":[3,11],"1":[2],"14":[15],"4":[5],"9":[10]},"parent":{"7":6,"18":17,"9":8,"13":12,"10":9,"17":13,"11":2,"5":4,"3":2,"8":7,"15":14,"1":0,"12":11,"2":1,"6":5,"14":13,"16":15,"19":18,"4":3}},"errorLeaves":[10,16],"unnecessaryRoots":[]}]
;